"""Shared Pydantic models for the research assistant agent."""
import operator
from typing import Annotated

from pydantic import BaseModel, Field
from langgraph.graph import MessagesState


###  Common Schema
class Analyst(BaseModel):
    """An AI analyst persona with a specific research focus."""

    affiliation: str = Field(
        description="Primary affiliation of the analyst.",
    )
    name: str = Field(
        description="Name of the analyst."
    )
    role: str = Field(
        description="Role of the analyst in the context of the topic.",
    )
    description: str = Field(
        description="Description of the analyst focus, background, and motives.",
    )
    @property
    def persona(self) -> str:
        """Return a formatted string summary of the analyst's identity."""
        return f"Name: {self.name}\nRole: {self.role}\nAffiliation: {self.affiliation}\nDescription: {self.description}\n"


class InterviewState(MessagesState):
    """State for a single analyst interview sub-graph."""

    max_num_turns: int # Number turns of conversation
    context: Annotated[list, operator.add] # Source docs
    analyst: Analyst # Analyst asking questions
    interview: str # Interview transcript
    sections: list # Final key we duplicate in outer state for Send() API
