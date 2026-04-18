import asyncio
import httpx
import json

async def run():
    async with httpx.AsyncClient() as client:
        # We try to get the entities using the recall endpoint first
        res = await client.post("http://localhost:8100/v1/recall", json={
            "query": "components machine",
            "top_k": 5,
            "include_entities": True
        }, headers={"Authorization": "Bearer koch-hindsight-key"})
        
        print(json.dumps(res.json(), indent=2))

asyncio.run(run())
