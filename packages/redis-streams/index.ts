import { createClient } from "redis";

const client = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();


interface WebsiteEvent {
    url : string;
    id: string
}

const STREAM_NAME = "betteruptime:website";

export const xadd = async (event: WebsiteEvent) => {
    try {
        const response = await client.xAdd(STREAM_NAME, "*" , {
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
            const response = await client.xAdd(STREAM_NAME, "*" , {
                url: event.url,
                id: event.id
            });
            console.log("Event added to Redis with IDs:", response)
        }
    } catch (error) {
        console.log("Error in adding bulk events to Redis stream:", error);
    }
}

export const xreadGroup = async (consumerGroup: string, consumerName: string) => {
    try {
        const response = await client.xReadGroup(consumerGroup, consumerName, {
            key: STREAM_NAME,
            id: ">"
        }, {
            COUNT: 2
        })
        return response;
    } catch (error) {
        console.log("Error in reading from Redis streams as consumer group:", error);
    }
}

export const xack = async (consumerGroup: string, eventId: string) => {
    try {
        const response = await client.xAck(STREAM_NAME, consumerGroup, eventId);
        console.log(`Acknowledged message with ID ${eventId} in consumer group ${consumerGroup}. Response:`, response);
        return response;
    } catch (error) {
        // console.log("Error in acknowledging messages in Redis stream:", error);
    }
}

export const xackBulk = async (consumerGroup: string, eventIds: string[]) => {
    try {
        let responses = [];
        for(let i = 0; i < eventIds.length; i++){
            const eventId = eventIds[i];
            if(!eventId){
                console.log(`Skipping acknowledgment for empty event ID at index ${i}`);
                continue;
            }
            const response = await client.xAck(STREAM_NAME, consumerGroup, eventId);
            console.log(`Acknowledged message with ID ${eventId} in consumer group ${consumerGroup}. Response:`, response);
            responses.push(response);
        }
        console.log("Bulk acknowledgment responses:", responses);
    } catch (error) {
        console.log("Error in acknowledging bulk messages in Redis stream:", error);
    }
}