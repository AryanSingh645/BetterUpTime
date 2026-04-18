import axios from "axios";
import {xreadGroup, xack, xackBulk, xadd} from "redis-streams/client"

const REGION_ID = process.env.REGION_ID!;
const WORKER_ID = process.env.WORKER_ID!;

if (!REGION_ID || !WORKER_ID) {
    console.error("REGION_ID and WORKER_ID must be set in environment variables.");
    throw new Error("Missing environment variables");
}

type messageType = {
    id : string;
    message: {
        id: string;
        url: string
    };
}

type xreadGroupResponse = {
    name: string;
    messages: messageType[];
}

async function checkHealth(url : string, websiteId : string) {
    return new Promise<{status: string, responseTime: number, websiteId : string}>((resolve, reject) => {
        
        const startTime = Date.now();
        
        axios.get(url, {timeout: 10_000})
        .then(async () => {
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            resolve({status: "UP", responseTime, websiteId})
            
        })
        .catch(async () => {
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            resolve({status: "DOWN", responseTime, websiteId})

        })
    })
}

async function main() {
    try {
        while (true) {
            const eventRead = await xreadGroup(process.env.STREAM_NAME!, REGION_ID, WORKER_ID, 2) as xreadGroupResponse[];
            if(!eventRead || eventRead.length === 0 || !eventRead[0]?.messages){
                continue;
            }
            else {
                const messages = eventRead[0].messages
                // NOTE: Ideally here should be a pusher for storing results into db because db conneection pool may get overloaded because of so many workers opening the connection on every request

                console.log("Event read from Redis stream:", messages);

                const webHealths = await Promise.allSettled(messages.map(async(m) => {
                    const webHealth = await checkHealth(m.message.url, m.message.id)
                    await xadd(process.env.DB_WRITE_STREAM_NAME!, {
                        status: webHealth.status as "UP" | "DOWN" | "UNKNOWN",
                        responseTime: webHealth.responseTime,
                        websiteId: webHealth.websiteId
                    })
                    return m.id;
                }))

                const ackIds = webHealths.filter((w) => w.status == 'fulfilled').map((w) => w.value)
                if(ackIds.length > 0){
                    await xackBulk(process.env.STREAM_NAME!, REGION_ID, ackIds)
                }

                console.log(`----------------------------${WORKER_ID}---------------------------`)
            }
        }
    } catch (error) {
        console.log("Error occurred in worker:", error);
    }
}

main();