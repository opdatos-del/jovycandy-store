import { model } from "@medusajs/framework/utils"

const HeroSettings = model.define("jovy_hero_settings", {
  id: model.id().primaryKey(),
  background_color: model.text().default("#00AFAA"),
})

export default HeroSettings
