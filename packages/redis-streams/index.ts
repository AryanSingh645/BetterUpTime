import { createClient } from "redis";

const client = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();


interface WebsiteEvent {
    url : string;
    id: string;
}

interface DBWriteEvent {
    status: "UP" | "DOWN" | "UNKNOWN";
    responseTime: number;
    websiteId: string;
}

export const xadd = async (STREAM_NAME: string, event: WebsiteEvent | DBWriteEvent) => {
    try {
        const eventData: Record<string, string> = {};
        for (const [key, value] of Object.entries(event)) {
            eventData[key] = String(value);
        }
        const response = await client.xAdd(STREAM_NAME, "*" , eventData);
        console.log("Event added to Redis with IDs:", response)
    } catch (error : any) {
        console.log("Error in adding event to Redis stream:", error?.message);
        throw error;
    }
}

export const xaddBulk = async(STREAM_NAME: string, events : WebsiteEvent[] | DBWriteEvent[]) => {
    try {
        for(let i = 0; i < events.length; i++){
            const event = events[i];
            if(!event || Object.keys(event).length == 0){
                console.log(`Skipping event at index ${i} due to missing url or id`);
                continue;
            }
            const eventData: Record<string, string> = {};
            for (const [key, value] of Object.entries(event)) {
                eventData[key] = String(value);
            }
            const response = await client.xAdd(STREAM_NAME, "*" , eventData);
            console.log("Event added to Redis with IDs:", response)
        }
    } catch (error : any) {
        console.log("Error in adding bulk events to Redis stream:", error?.message);
        throw error;
    }
}

export const xreadGroup = async (STREAM_NAME: string, consumerGroup: string, consumerName: string, COUNT: number) => {
    try {
        const response = await client.xReadGroup(consumerGroup, consumerName, {
            key: STREAM_NAME,
            id: ">"
        }, {
            COUNT,
            BLOCK: 5000
        })
        return response;
    } catch (error : any) {
        console.log("Error in reading from Redis streams as consumer group:", error?.message);
        throw error;
    }
}

export const xack = async (STREAM_NAME: string, consumerGroup: string, eventId: string) => {
    try {
        const response = await client.xAck(STREAM_NAME, consumerGroup, eventId);
        console.log(`Acknowledged message with ID ${eventId} in consumer group ${consumerGroup}. Response:`, response);
        return response;
    } catch (error : any) {
        console.log("Error in acknowledging messages in Redis stream:", error?.message);
        throw error;
    }
}

export const xackBulk = async (STREAM_NAME: string, consumerGroup: string, eventIds: string[]) => {
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
    } catch (error : any) {
        console.log("Error in acknowledging bulk messages in Redis stream:", error?.message);
        throw error;
    }
}