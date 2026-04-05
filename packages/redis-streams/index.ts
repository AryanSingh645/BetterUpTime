import { createClient } from "redis";

const client = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();


interface WebsiteEvent {
    url : string;
    id: string
}

export const xadd = async (event: WebsiteEvent) => {
    try {
        const response = await client.xAdd("betteruptime:website", "*" , {
            url: event.url,
            id: event.id
        });
        console.log("Event added to Redis with IDs:", response)
    } catch (error) {
        console.log("Error in adding event to Redis stream:", error);
    }
}

export const xaddBulk = async(events : WebsiteEvent[]) => {
    try {
        for(let i = 0; i < events.length; i++){
            const event = events[i];
            if(!event || !event.url || !event.id){
                console.log(`Skipping event at index ${i} due to missing url or id`);
                continue;
            }
            await client.xAdd("betteruptime:website", "*" , {
                url: event.url,
                id: event.id
            });
        }
    } catch (error) {
        console.log("Error in adding bulk events to Redis stream:", error);
    }
}