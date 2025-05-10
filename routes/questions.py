from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from db import get_db
from utils import get_current_user

router = APIRouter()

class QuestionInput(BaseModel):
    question: str

@router.post("/")
async def ask_question(q: QuestionInput, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Placeholder: implement logic to answer questions about the user
    return {"answer": "Not implemented yet"}
