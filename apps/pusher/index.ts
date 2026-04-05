import {xaddBulk} from "redis-streams/client"
import {prisma} from "store/client"

async function main() {
    try {
        const websites = await prisma.website.findMany({
            select: {
                id: true,
                url: true
            }
        })

        await xaddBulk(websites.map(w => ({id: w.id, url: w.url})))

    } catch (error) {
        console.log("Error in pusher app:", error);
    }
}

main();

setInterval(main, 180 * 1000)

