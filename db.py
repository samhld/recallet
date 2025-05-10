import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.dialects.mysql import VARCHAR
from sqlalchemy.sql import func
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_async_engine(DATABASE_URL, echo=True, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

async def get_db():
    async with SessionLocal() as session:
        yield session

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(256), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    
    @classmethod
    async def get_by_email(cls, db: AsyncSession, email: str):
        result = await db.execute(
            func.select(cls).where(cls.email == email)
        )
        return result.scalars().first()

    @classmethod
    async def create(cls, db: AsyncSession, email: str, hashed_password: str):
        user = cls(email=email, hashed_password=hashed_password)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

class Entity(Base):
    __tablename__ = "entities"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(VARCHAR(512))
    description = Column(Text)
    description_vec = Column(Text)  # Store as JSON/text for now

    @classmethod
    async def bulk_create(cls, db: AsyncSession, entities: list):
        objs = [cls(**e) for e in entities]
        db.add_all(objs)
        await db.commit()
        return objs

class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(Integer, primary_key=True, index=True)
    source_entity_id = Column(Integer, ForeignKey("entities.id"))
    target_entity_id = Column(Integer, ForeignKey("entities.id"))
    relationship_desc = Column(Text)

    @classmethod
    async def bulk_create(cls, db: AsyncSession, relationships: list, entity_objs: list):
        # Map entity names to IDs
        name_to_id = {e.name: e.id for e in entity_objs}
        objs = [cls(source_entity_id=name_to_id.get(r["source"]), target_entity_id=name_to_id.get(r["target"]), relationship_desc=r["desc"]) for r in relationships]
        db.add_all(objs)
        await db.commit()
        return objs
