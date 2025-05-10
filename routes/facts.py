from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from db import get_db, Entity, Relationship
from utils import get_current_user, extract_entities_and_relationships

router = APIRouter()

class FactInput(BaseModel):
    fact: str

@router.post("/")
async def submit_fact(fact: FactInput, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    entities, relationships = await extract_entities_and_relationships(fact.fact)
    # Store entities and relationships
    entity_objs = await Entity.bulk_create(db, entities)
    await Relationship.bulk_create(db, relationships, entity_objs)
    return {"entities": entities, "relationships": relationships}
