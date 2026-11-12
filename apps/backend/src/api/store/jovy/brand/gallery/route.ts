import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { isPublicBrandItem } from "@jovy/lib/jovy/brand"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
export async function GET(req:MedusaRequest,res:MedusaResponse){const s=req.scope.resolve(JOVY_BRAND_MODULE);const files=req.scope.resolve(Modules.FILE);const items=(await s.listJovyGalleryItems({}, {order:{sort_order:"ASC",created_at:"ASC"}})).filter((item)=>isPublicBrandItem(item));res.json({items:await Promise.all(items.map(async item=>{let media_url:null|string=null;try{media_url=(await files.retrieveFile(item.media_file_id)).url}catch{}return {id:item.id,title:item.title,description:item.description,sort_order:item.sort_order,media_url}}))})}
