import {xackBulk, xreadGroup} from "redis-streams/client"
import {prisma} from "store/client"

const REGION_ID = process.env.REGION_ID
const WORKER_ID = process.env.WORKER_ID
const STREAM_NAME = process.env.STREAM_NAME

if(!REGION_ID || !WORKER_ID || !STREAM_NAME){
    console.error("REGION_ID, WORKER_ID and STREAM_NAME must be set in environment variables.");
    throw new Error("Missing environment variables");
}

type messageType = {
    id: string;
    message: {
        status: "UP" | "DOWN" | "UNKNOWN";
        responseTime: number;
        websiteId: string;
    }
}

type xreadGroupResponse = {
    name: string;
    messages: messageType[];
}

const main = async() => {
    try { // NOTE: try-catch block for xread error-handling
        while(true){
            const eventRead = await xreadGroup(STREAM_NAME, REGION_ID, WORKER_ID, 100) as xreadGroupResponse[];

            if(!eventRead || eventRead.length == 0 || !eventRead[0]?.messages){
                continue;
            }
            const messages = eventRead[0].messages;
            
            console.log("Event read from Redis stream:", messages);
            
            const bulkStatus = messages.map((m) => {
                return {
                    status: m.message.status,
                    website_id: m.message.websiteId,
                    region_id: REGION_ID,
                    response_time: Number(m.message.responseTime)
                }
            })

            try { // NOTE: try-catch block for bulk db_write error handling
                await prisma.websiteTick.createMany({
                    data: bulkStatus
                })
    
                const ackIds = messages.map(m => m.id)
                await xackBulk(STREAM_NAME, REGION_ID, ackIds)

            } catch (error) {

                const ackIds = []
                for(const m of messages){
                    try { // NOTE: try-catch block for individual db-write error handling
                        await prisma.websiteTick.create({
                            data: {
                                status: m.message.status,
                                website_id: m.message.websiteId,
                                region_id: REGION_ID,
                                response_time: Number(m.message.responseTime)
                            }
                        })

                        ackIds.push(m.id)

                    } catch (error) {
                        console.log(`Failed to write tick for website ${m.message.websiteId}`, error);                     
                    }
                }
                
                if(ackIds.length > 0){
                    await xackBulk(process.env.STREAM_NAME!, REGION_ID, ackIds)
                }
            }

            console.log(`---------------------------DB_WRITER-${WORKER_ID}---------------------------`)
        }
    } catch (error) {
        console.error("Fatal error in DB writer worker:", error);
        process.exit(1);
    }
}

main();