"""
Configuration settings for LLM interactions
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

class LLMSettings(BaseSettings):
    """Settings for LLM interactions"""
    
    # System prompt settings
    DEFAULT_SYSTEM_PROMPT: str = Field(
        default="You are a helpful assistant.",
        description="Process and parse all information in "Test text 1" and "Test text 2" at bottom according to the schema that follows. Ultimately the extracted parts will be parts of rows inserted into a database. Subjects and objects of the text should be extracted as entities and the relationship between them should be extracted as well. 

Schema is just a list of rows with anonymized values in them pertaining to Schema: {entity, relationship, entity}

Examples, depending on how long the input text to be parsed is, may look like:
Rows: {entity_1, relationship_to, entity_2}, {entity_2, relationship_to, entity_1}, {entity_3, relationship_to, entity_1}, {entity_1, relationship_to, entity_3}

When returning output, ONLY return the output rows. If multiple rows, separate them with new lines. New lines should be the ONLY additional text in the response. No other text before or after the output rows.

Example text, example output:
text 1: artist1 is my favorite artist
output 1: {user, favorite artist, artist1}, {artist1, is favorite artist of, user}

text 2: "artist1, artist2, and artist3 are my favorite artists"
output 2: {user, favorite country artist, artist1}, {user, favorite artist, artist2}, {user, favorite artist, artist3}, {artist1, is favorite artist of, user}, {artist2, is favorite artist of, user}, {artist3, is favorite artist of, user}

text 3: "my favorite nail polish colors are opi put it in neutral and love is in the bare"
output 3: {user, favorite nail polish, polish1}, {user, favorite nail polish, polish2}, {polish1, is favorite nail polish of, user}, {, is favorite nail polish of, user}

text 4: "intelligentsia silver lake is a great place to work-study"
output 4: {user, considers is a great place to work, intelli silver lake}, {intelligentsia silver lake, is considered a great place to work by, user}"
    )
    
    # Model settings
    DEFAULT_MODEL: str = Field(
        default="gpt-4",
        description="Default model to use for LLM interactions"
    )
    
    # Temperature settings
    DEFAULT_TEMPERATURE: float = Field(
        default=0.7,
        description="Default temperature for LLM responses"
    )
    
    # Response settings
    MAX_TOKENS: int = Field(
        default=2000,
        description="Maximum tokens to generate in responses"
    )
    
    # API settings
    API_KEY: str = Field(
        default_factory=lambda: os.getenv("OPENAI_API_KEY"),
        description="API key for OpenAI service"
    )
    
    class Config:
        env_prefix = "LLM_"
        
# Create a singleton instance
llm_settings = LLMSettings()
