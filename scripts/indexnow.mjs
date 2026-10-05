// Tells Bing (and the other IndexNow engines: Yandex, Seznam, Naver) that
// the site's pages changed, so they recrawl within hours instead of weeks.
// Google does not use IndexNow. Run after a production deploy is live:
//   npm run indexnow
// The key file public/KEY.txt must be served at the site root.
const SITE = "https://hielda.com"
const KEY = "f6ae750643d651ab9f7273d8e1a8fbf8"

const xml = await (await fetch(SITE + "/sitemap.xml")).text()
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
if (!urlList.length) throw new Error("sitemap had no URLs")

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "hielda.com", key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
})
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`)
if (res.status >= 400) process.exit(1)
