import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  assertLabCampaignDatabase,
  assertLabCampaignServerIdentity,
  campaignTargetRules,
  parseLabDatabaseIdentity,
  POSTGRES_IDENTITY_QUERY,
  resolveLabCampaignConfig,
  selectCampaignVariants,
  type CampaignProductRow,
} from "../lab-campaign"

const NOW = new Date("2026-11-26T18:00:00.000Z")

function baseUrl(port = 5433, database = "jovy_lab", user = "jovy") {
  return `postgres://${user}:secret@localhost:${port}/${database}`
}

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "development",
    DATABASE_URL: baseUrl(),
    JOVY_CAMPAIGN_START: "2026-11-26T18:00:00.000Z",
    JOVY_CAMPAIGN_END: "2026-12-10T18:00:00.000Z",
    JOVY_CAMPAIGN_SALE_PERCENT: "20",
    JOVY_CAMPAIGN_COUPON_PERCENT: "10",
    JOVY_CAMPAIGN_AUTOMATIC_PERCENT: "15",
    JOVY_CAMPAIGN_VARIANT_LIMIT: "5",
    JOVY_CAMPAIGN_FIXED_AMOUNT: "50",
  }
}

function ephemeralEnvironment(root: string): NodeJS.ProcessEnv {
  const runId = "11111111-1111-4111-8111-111111111111"
  const localAppData = root
  const runRoot = path.join(localAppData, "JovyCandy", "integration-runs", runId)
  const dataDirectory = path.join(runRoot, "data")
  fs.mkdirSync(dataDirectory, { recursive: true })
  fs.writeFileSync(
    path.join(runRoot, "run.json"),
    JSON.stringify({
      runId,
      port: 5433,
      postgresPid: 1234,
      user: "jovy",
      dataDirectory,
      cluster: "jovy_it_test",
    }),
  )
  return {
    ...validEnvironment(),
    LOCALAPPDATA: localAppData,
    JOVY_EPHEMERAL_POSTGRES: "1",
    JOVY_EPHEMERAL_POSTGRES_RUN_ID: runId,
    JOVY_EPHEMERAL_POSTGRES_ROOT: runRoot,
    JOVY_EPHEMERAL_POSTGRES_DATA_DIRECTORY: dataDirectory,
    JOVY_EPHEMERAL_POSTGRES_PORT: "5433",
  }
}

describe("guardas de campaña de laboratorio", () => {
  let temporaryRoots: string[] = []

  afterEach(() => {
    for (const root of temporaryRoots) {
      fs.rmSync(root, { recursive: true, force: true })
    }
    temporaryRoots = []
  })

  it("rechaza producción y staging antes de mirar la base", () => {
    expect(() =>
      assertLabCampaignDatabase(
        { ...validEnvironment(), NODE_ENV: "production" },
        parseLabDatabaseIdentity(validEnvironment().DATABASE_URL),
      ),
    ).toThrow(expect.objectContaining({ code: "forbidden_environment" }))

    expect(() =>
      assertLabCampaignDatabase(
        { ...validEnvironment(), DEPLOYMENT_ENV: "staging" },
        parseLabDatabaseIdentity(validEnvironment().DATABASE_URL),
      ),
    ).toThrow(expect.objectContaining({ code: "forbidden_environment" }))
  })

  it("rechaza hosts no loopback", () => {
    expect(() =>
      parseLabDatabaseIdentity("postgres://user:secret@db.example.com:5433/lab"),
    ).toThrow(expect.objectContaining({ code: "non_loopback_database" }))
  })

  it("prohíbe siempre los puertos persistentes protegidos", () => {
    for (const port of [5432, 55432]) {
      expect(() =>
        assertLabCampaignDatabase(
          validEnvironment(),
          parseLabDatabaseIdentity(baseUrl(port)),
        ),
      ).toThrow(expect.objectContaining({ code: "protected_port" }))
    }
  })

  it("acepta una base local autorizada por allowlist fuera del repositorio", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "jovy-lab-allowlist-"))
    temporaryRoots.push(root)
    const identity = parseLabDatabaseIdentity(baseUrl(5533))
    const allowlistFile = path.join(root, "lab-databases.json")
    fs.writeFileSync(
      allowlistFile,
      JSON.stringify({
        version: 1,
        databases: [
          {
            fingerprint: identity.fingerprint,
            host: identity.host,
            port: identity.port,
            database: identity.database,
            user: identity.user,
            data_directory: path.join(root, "data"),
            cluster_name: "jovy_manual_lab",
          },
        ],
      }),
    )

    expect(() =>
      assertLabCampaignDatabase(
        {
          ...validEnvironment(),
          DATABASE_URL: baseUrl(5533),
          JOVY_LAB_DATABASE_ALLOWLIST_FILE: allowlistFile,
          JOVY_LAB_DATABASE_CONFIRM: "authorized",
        },
        identity,
      ),
    ).not.toThrow()

    expect(() =>
      assertLabCampaignDatabase(
        {
          ...validEnvironment(),
          DATABASE_URL: baseUrl(5533),
          JOVY_LAB_DATABASE_ALLOWLIST_FILE: allowlistFile,
          JOVY_LAB_DATABASE_CONFIRM: "yes",
        },
        identity,
      ),
    ).toThrow(expect.objectContaining({ code: "database_not_authorized" }))
  })

  it("acepta un cluster efímero con marcador verificable", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "jovy-lab-"))
    temporaryRoots.push(root)
    const environment = ephemeralEnvironment(root)
    const identity = parseLabDatabaseIdentity(environment.DATABASE_URL)

    expect(() => assertLabCampaignDatabase(environment, identity)).not.toThrow()

    expect(() =>
      assertLabCampaignDatabase(
        { ...environment, JOVY_EPHEMERAL_POSTGRES_PORT: "5444" },
        identity,
      ),
    ).toThrow(expect.objectContaining({ code: "ephemeral_identity_mismatch" }))
  })

  it("verifica la identidad real del servidor efímero antes de escribir", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "jovy-lab-server-"))
    temporaryRoots.push(root)
    const environment = ephemeralEnvironment(root)
    const identity = parseLabDatabaseIdentity(environment.DATABASE_URL)
    const dataDirectory = environment.JOVY_EPHEMERAL_POSTGRES_DATA_DIRECTORY as string

    const query = async (sql: string) => {
      expect(sql).toBe(POSTGRES_IDENTITY_QUERY)
      return {
        rows: [
          {
            database: "jovy_lab",
            username: "jovy",
            server_port: 5433,
            server_address: "127.0.0.1",
            data_directory: dataDirectory,
            cluster_name: "jovy_it_test",
            listen_addresses: "127.0.0.1",
            version: "PostgreSQL 18.6",
          },
        ],
      }
    }

    await expect(
      assertLabCampaignServerIdentity(environment, identity, { query }),
    ).resolves.toMatchObject({ port: 5433, database: "jovy_lab" })

    await expect(
      assertLabCampaignServerIdentity(
        environment,
        identity,
        {
          query: async (sql: string) => {
            expect(sql).toBe(POSTGRES_IDENTITY_QUERY)
            return {
              rows: [
                {
                  database: "jovy_lab",
                  username: "jovy",
                  server_port: 5433,
                  server_address: "127.0.0.1",
                  data_directory: dataDirectory,
                  cluster_name: "otro_cluster",
                  listen_addresses: "127.0.0.1",
                  version: "PostgreSQL 18.6",
                },
              ],
            }
          },
        },
      ),
    ).rejects.toMatchObject({ code: "server_identity_mismatch" })
  })

  it("verifica el servidor manual contra su allowlist", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "jovy-lab-manual-"))
    temporaryRoots.push(root)
    const identity = parseLabDatabaseIdentity(baseUrl(5533))
    const dataDirectory = path.join(root, "data")
    const allowlist = {
      version: 1 as const,
      databases: [
        {
          fingerprint: identity.fingerprint,
          host: identity.host,
          port: identity.port,
          database: identity.database,
          user: identity.user,
          data_directory: dataDirectory,
          cluster_name: "jovy_manual_lab",
        },
      ],
    }

    const query = async (sql: string) => {
      expect(sql).toBe(POSTGRES_IDENTITY_QUERY)
      return {
        rows: [
          {
            database: "jovy_lab",
            username: "jovy",
            server_port: 5533,
            server_address: "127.0.0.1",
            data_directory: dataDirectory,
            cluster_name: "jovy_manual_lab",
            listen_addresses: "*",
            version: "PostgreSQL 18.6",
          },
        ],
      }
    }

    await expect(
      assertLabCampaignServerIdentity(
        {
          ...validEnvironment(),
          DATABASE_URL: baseUrl(5533),
          JOVY_LAB_DATABASE_CONFIRM: "authorized",
        },
        identity,
        { query, allowlist },
      ),
    ).resolves.toMatchObject({ clusterName: "jovy_manual_lab" })
  })

  it("rechaza fechas inválidas, pasadas o demasiado largas", () => {
    expect(() =>
      resolveLabCampaignConfig(
        { ...validEnvironment(), JOVY_CAMPAIGN_START: "no-es-fecha" },
        NOW,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid_date" }))

    expect(() =>
      resolveLabCampaignConfig(
        {
          ...validEnvironment(),
          JOVY_CAMPAIGN_START: "2026-12-10T18:00:00.000Z",
          JOVY_CAMPAIGN_END: "2026-11-26T18:00:00.000Z",
        },
        NOW,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid_date" }))

    expect(() =>
      resolveLabCampaignConfig(
        {
          ...validEnvironment(),
          JOVY_CAMPAIGN_START: "2025-01-01T00:00:00.000Z",
          JOVY_CAMPAIGN_END: "2026-12-31T00:00:00.000Z",
        },
        NOW,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid_range" }))

    expect(() =>
      resolveLabCampaignConfig(
        {
          ...validEnvironment(),
          JOVY_CAMPAIGN_START: "2026-11-01T00:00:00.000Z",
          JOVY_CAMPAIGN_END: "2026-11-02T00:00:00.000Z",
        },
        NOW,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid_date" }))
  })

  it("valida porcentajes, límites y montos", () => {
    const invalid = [
      ["JOVY_CAMPAIGN_SALE_PERCENT", "0"],
      ["JOVY_CAMPAIGN_SALE_PERCENT", "91"],
      ["JOVY_CAMPAIGN_COUPON_PERCENT", "0"],
      ["JOVY_CAMPAIGN_AUTOMATIC_PERCENT", "100"],
      ["JOVY_CAMPAIGN_VARIANT_LIMIT", "0"],
      ["JOVY_CAMPAIGN_VARIANT_LIMIT", "51"],
      ["JOVY_CAMPAIGN_FIXED_AMOUNT", "0"],
      ["JOVY_CAMPAIGN_FIXED_AMOUNT", "abc"],
    ] as const

    for (const [key, value] of invalid) {
      expect(() =>
        resolveLabCampaignConfig({ ...validEnvironment(), [key]: value }, NOW),
      ).toThrow()
    }
  })

  it("rechaza códigos inválidos o duplicados", () => {
    expect(() =>
      resolveLabCampaignConfig(
        { ...validEnvironment(), JOVY_CAMPAIGN_CODE_PERCENT: "con espacios" },
        NOW,
      ),
    ).toThrow(expect.objectContaining({ code: "invalid_code" }))

    expect(() =>
      resolveLabCampaignConfig(
        {
          ...validEnvironment(),
          JOVY_CAMPAIGN_CODE_PERCENT: "MISMO",
          JOVY_CAMPAIGN_CODE_FIXED: "MISMO",
        },
        NOW,
      ),
    ).toThrow(expect.objectContaining({ code: "duplicate_code" }))
  })
})

const products: CampaignProductRow[] = [
  {
    id: "prod_b",
    variants: [
      {
        id: "variant_b2",
        sku: "SKU-B2",
        price_set: {
          id: "pset_b2",
          prices: [{ amount: 200, currency_code: "mxn" }],
        },
      },
      {
        id: "variant_b1",
        sku: "SKU-B1",
        price_set: {
          id: "pset_b1",
          prices: [{ amount: 100, currency_code: "mxn" }],
        },
      },
    ],
  },
  {
    id: "prod_a",
    variants: [
      {
        id: "variant_a1",
        sku: "SKU-A1",
        price_set: {
          id: "pset_a1",
          prices: [{ amount: 300, currency_code: "mxn" }],
        },
      },
      {
        id: "variant_usd",
        sku: "SKU-USD",
        price_set: {
          id: "pset_usd",
          prices: [{ amount: 10, currency_code: "usd" }],
        },
      },
    ],
  },
]

describe("selección de variantes de campaña", () => {
  it("selecciona de forma determinista por SKU", () => {
    expect(selectCampaignVariants(products, [], 3).map((item) => item.sku)).toEqual([
      "SKU-A1",
      "SKU-B1",
      "SKU-B2",
    ])
  })

  it("rechaza SKU solicitados que no existen", () => {
    expect(() =>
      selectCampaignVariants(products, ["SKU-A1", "SKU-NO-EXISTE"], 5),
    ).toThrow(expect.objectContaining({ code: "missing_skus" }))
  })

  it("rechaza más SKU solicitados que el límite", () => {
    expect(() =>
      selectCampaignVariants(products, ["SKU-A1", "SKU-B1"], 1),
    ).toThrow(expect.objectContaining({ code: "invalid_range" }))
  })

  it("rechaza conjuntos sin variantes con precio MXN", () => {
    expect(() =>
      selectCampaignVariants(
        [
          {
            id: "prod_usd",
            variants: [
              {
                id: "variant_usd",
                sku: "USD",
                price_set: {
                  id: "pset_usd",
                  prices: [{ amount: 10, currency_code: "usd" }],
                },
              },
            ],
          },
        ],
        [],
        5,
      ),
    ).toThrow(expect.objectContaining({ code: "no_variants" }))
  })

  it("limita la promoción automática a los productos seleccionados", () => {
    expect(campaignTargetRules(["prod_b", "prod_a", "prod_b"])).toEqual([
      {
        attribute: "items.product.id",
        operator: "in",
        values: ["prod_a", "prod_b"],
      },
    ])
  })
})
