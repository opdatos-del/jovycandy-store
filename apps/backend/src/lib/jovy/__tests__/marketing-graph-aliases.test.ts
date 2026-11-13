import { defineJoinerConfig, toPascalCase } from "@medusajs/framework/utils"

import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import HeroItem from "@jovy/modules/jovy-marketing/models/hero-item"
import JovyMarketingModuleService from "@jovy/modules/jovy-marketing/service"

type GraphAlias = { entity: string; args?: { methodSuffix?: string } }

function heroAlias() {
  const joiner = defineJoinerConfig(JOVY_MARKETING_MODULE, { models: [HeroItem] })
  const alias = (joiner.alias as GraphAlias[]).find((candidate) => candidate.entity === "JovyHeroItem")
  expect(alias).toBeTruthy()
  expect(alias?.args?.methodSuffix).toBeTruthy()
  return alias as GraphAlias & { args: { methodSuffix: string } }
}

function graphMethod(prefix: "list" | "listAndCount") {
  return `${prefix}${toPascalCase(heroAlias().args.methodSuffix)}`
}

describe("aliases de Remote Query para el Hero", () => {
  it("expone los métodos que @medusajs/query busca a partir del alias JovyHeroItem", () => {
    for (const methodName of [graphMethod("list"), graphMethod("listAndCount")]) {
      expect(typeof (JovyMarketingModuleService.prototype as unknown as Record<string, unknown>)[methodName]).toBe("function")
    }
  })

  it("delega en los métodos generados por MedusaService", async () => {
    const calls: unknown[][] = []
    const fake = {
      listHeroItems: (...args: unknown[]) => {
        calls.push(args)
        return []
      },
      listAndCountHeroItems: (...args: unknown[]) => {
        calls.push(args)
        return [[], 0]
      },
    }
    const prototype = JovyMarketingModuleService.prototype as unknown as Record<string, (...args: unknown[]) => unknown>

    await prototype[graphMethod("list")].call(fake, { id: "hero_1" }, { take: 1 })
    await prototype[graphMethod("listAndCount")].call(fake, {}, { skip: 0 })

    expect(calls).toEqual([
      [{ id: "hero_1" }, { take: 1 }],
      [{}, { skip: 0 }],
    ])
  })
})
