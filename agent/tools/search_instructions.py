"""Shared search query schema and instructions for web and Wikipedia tools."""
from langchain_core.messages import SystemMessage
from pydantic import BaseModel, Field


class SearchQuery(BaseModel):
    """Structured output for a retrieval or web-search query."""

    search_query: str = Field(None, description="Search query for retrieval.")


search_instructions = SystemMessage(content="""You will be given a conversation between an analyst and an expert.

Your goal is to generate a well-structured query for use in retrieval and / or web-search related to the conversation.

First, analyze the full conversation.

Pay particular attention to the final question posed by the analyst.

Convert this final question into a well-structured web search query""")
