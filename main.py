from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, facts, questions

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(facts.router, prefix="/facts", tags=["facts"])
app.include_router(questions.router, prefix="/questions", tags=["questions"])

@app.get("/")
def root():
    return {"message": "API is running"}
