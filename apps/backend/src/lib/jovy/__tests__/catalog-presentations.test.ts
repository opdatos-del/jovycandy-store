import {
  buildPresentations,
  editorialWeightLabel,
  formatGrams,
  gramsFromLabel,
  parseWeightGrams,
  presentationLadder,
  presentationPriceMxn,
} from "@jovy/lib/jovy/catalog-presentations"

describe("parseWeightGrams", () => {
  it("convierte onzas, gramos, kilos y libras", () => {
    expect(parseWeightGrams("6 oz")).toBe(170)
    expect(parseWeightGrams("5.29 oz")).toBe(150)
    expect(parseWeightGrams("141 g")).toBe(141)
    expect(parseWeightGrams("1 kg")).toBe(1000)
    expect(parseWeightGrams("1 lb")).toBe(454)
  })

  it("rechaza valores vacíos o no reconocidos", () => {
    expect(parseWeightGrams("")).toBeNull()
    expect(parseWeightGrams(null)).toBeNull()
    expect(parseWeightGrams("presentación grande")).toBeNull()
    expect(parseWeightGrams("0 oz")).toBeNull()
  })
})

describe("formatGrams", () => {
  it("usa gramos por debajo de un kilo y kilos por encima", () => {
    expect(formatGrams(170)).toBe("170 g")
    expect(formatGrams(500)).toBe("500 g")
    expect(formatGrams(1000)).toBe("1 kg")
    expect(formatGrams(1500)).toBe("1.5 kg")
  })
})

describe("presentationLadder", () => {
  it("conserva el paquete base y agrega tamaños mayores cortos", () => {
    expect(presentationLadder(170)).toEqual([170, 250, 500])
    expect(presentationLadder(500)).toEqual([500, 1000])
    expect(presentationLadder(1000)).toEqual([250, 500, 1000])
  })

  it("ordena, deduplica y nunca regresa tamaños inválidos", () => {
    const ladder = presentationLadder(170)
    expect([...ladder].sort((a, b) => a - b)).toEqual(ladder)
    expect(new Set(ladder).size).toBe(ladder.length)
    expect(presentationLadder(0)).toEqual([])
  })
})

describe("presentationPriceMxn", () => {
  it("mantiene el precio de seed para el paquete base", () => {
    expect(presentationPriceMxn(45, 170, 170)).toBe(45)
  })

  it("escala proporcionalmente con descuento por volumen", () => {
    const small = presentationPriceMxn(45, 170, 250)
    const medium = presentationPriceMxn(45, 170, 500)
    const large = presentationPriceMxn(45, 170, 1000)

    expect(small).toBeGreaterThan(45)
    expect(medium).toBeGreaterThan(small)
    expect(large).toBeGreaterThan(medium)
    // El kilo aplica descuento frente al precio proporcional sin descuento.
    expect(large).toBeLessThan(Math.round((45 / 170) * 1000))
  })

  it("nunca regresa precios negativos o cero", () => {
    expect(presentationPriceMxn(0, 170, 500)).toBe(10)
  })
})

describe("buildPresentations", () => {
  it("arma etiquetas y precios con el gramo como unidad principal", () => {
    const presentations = buildPresentations("6 oz", 45)
    expect(presentations.map((item) => item.label)).toEqual(["170 g", "250 g", "500 g"])
    expect(presentations[0]).toMatchObject({ grams: 170, priceMxn: 45 })
    expect(presentations.every((item) => item.priceMxn >= 10)).toBe(true)
  })

  it("regresa una lista vacía si el gramaje no se puede interpretar", () => {
    expect(buildPresentations("bolsa familiar", 45)).toEqual([])
  })
})

describe("utilidades de etiqueta", () => {
  it("convierte el gramaje editorial a gramos", () => {
    expect(editorialWeightLabel("6 oz")).toBe("170 g")
    expect(editorialWeightLabel("1 kg")).toBe("1 kg")
    expect(editorialWeightLabel(null)).toBeNull()
  })

  it("ordena etiquetas por gramaje y manda las desconocidas al final", () => {
    const labels = ["500 g", "170 g", "1 kg", "extra"]
    expect([...labels].sort((a, b) => gramsFromLabel(a) - gramsFromLabel(b))).toEqual([
      "170 g",
      "500 g",
      "1 kg",
      "extra",
    ])
  })
})
