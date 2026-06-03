from functools import partial
import operator
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Annotated, List
from typing_extensions import TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, get_buffer_string
from langchain_openai import ChatOpenAI

from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph

from common import Analyst, InterviewState
from tools import search_web, search_wikipedia
from constants import (
    MODEL_NAME,
    MODEL_TEMPERATURE,
    DEFAULT_MAX_ANALYSTS,
    DEFAULT_MAX_TURNS,
    EXPERT_NAME,
    INTERVIEW_END_PHRASE,
    REPORT_SEPARATOR,
    REPORT_INSIGHTS_HEADER,
    REPORT_SOURCES_SEPARATOR,
    SECTION_MAX_WORDS,
    INTRO_CONCLUSION_TARGET_WORDS,
)

### Load environment variables from .env file
load_dotenv()

### LLM
llm = ChatOpenAI(model=MODEL_NAME, temperature=MODEL_TEMPERATURE) 

### Schema 
class Perspectives(BaseModel):
    analysts: List[Analyst] = Field(
        description="Comprehensive list of analysts with their roles and affiliations.",
    )

class GenerateAnalystsState(TypedDict):
    topic: str # Research topic
    max_analysts: int # Number of analysts
    human_analyst_feedback: str # Human feedback
    analysts: List[Analyst] # Analyst asking questions

class SearchQuery(BaseModel):
    search_query: str = Field(None, description="Search query for retrieval.")

class ResearchGraphState(TypedDict):
    topic: str # Research topic
    max_analysts: int # Number of analysts
    human_analyst_feedback: str # Human feedback
    analysts: List[Analyst] # Analyst asking questions
    sections: Annotated[list, operator.add] # Send() API key
    introduction: str # Introduction for the final report
    content: str # Content for the final report
    conclusion: str # Conclusion for the final report
    final_report: str # Final report

### Nodes and edges
analyst_instructions="""You are creating {max_analysts} AI analyst personas for this research topic: {topic}

Editorial feedback (if any): {human_analyst_feedback}

Identify the {max_analysts} most compelling sub-themes from the topic and feedback. Assign one analyst persona to each theme."""

def create_analysts(state: GenerateAnalystsState):
    
    """ Create analysts """
    topic=state['topic']
   
    if 'max_analysts' in state and state['max_analysts'] is not None:
        max_analysts=state['max_analysts']
    else:
        max_analysts=DEFAULT_MAX_ANALYSTS

    if 'human_analyst_feedback' in state:    
        human_analyst_feedback=state.get('human_analyst_feedback')
    else:
        human_analyst_feedback=''
        
    # Enforce structured output
    structured_llm = llm.with_structured_output(Perspectives)

    # System message
    system_message = analyst_instructions.format(topic=topic,
                                                            human_analyst_feedback=human_analyst_feedback, 
                                                            max_analysts=max_analysts)

    # Generate question 
    analysts = structured_llm.invoke([SystemMessage(content=system_message)]+[HumanMessage(content="Generate the set of analysts.")])
    
    # Write the list of analysis to state
    return {"analysts": analysts.analysts}

def human_feedback(state: GenerateAnalystsState):
    """ No-op node that should be interrupted on """
    pass

# Analyst question instructions
question_instructions = """You are an analyst interviewing an expert. Stay in character throughout.

Your topic and goals: {goals}

Drive toward two types of insights:
1. Surprising or non-obvious findings people wouldn't expect.
2. Specific examples, not generalities.

Begin by introducing yourself with a name that fits your persona, then ask your first question. Keep probing to deepen your understanding.

When satisfied, end the interview with: "Thank you so much for your help!" """

def generate_question(state: InterviewState):

    """ Node to generate a question """

    # Get state
    analyst = state["analyst"]
    messages = state["messages"]

    # Generate question 
    system_message = question_instructions.format(goals=analyst.persona)
    question = llm.invoke([SystemMessage(content=system_message)]+messages)
        
    # Write messages to state
    return {"messages": [question]}


# Generate expert answer
answer_instructions = """You are an expert being interviewed by an analyst.

Analyst area of focus: {goals}

Answer using only the information in the context below — do not introduce outside knowledge or assumptions.

Context: {context}

Citation rules:
1. Each source document has its name at the top inside a <Document tag.
2. Cite sources inline next to relevant statements, e.g. [1], [2].
3. List all sources at the bottom in order: [1] Source 1, [2] Source 2, etc.
4. For document sources like <Document source="assistant/docs/llama3_1.pdf" page="7"/>, cite as: [1] assistant/docs/llama3_1.pdf, page 7"""

def generate_answer(state: InterviewState):
    
    """ Node to answer a question """

    # Get state
    analyst = state["analyst"]
    messages = state["messages"]
    context = state["context"]

    # Answer question
    system_message = answer_instructions.format(goals=analyst.persona, context=context)
    answer = llm.invoke([SystemMessage(content=system_message)]+messages)
            
    # Name the message as coming from the expert
    answer.name = "expert"
    
    # Append it to state
    return {"messages": [answer]}

def save_interview(state: InterviewState):
    
    """ Save interviews """

    # Get messages
    messages = state["messages"]
    
    # Convert interview to a string
    interview = get_buffer_string(messages)
    
    # Save to interviews key
    return {"interview": interview}

def route_messages(state: InterviewState,
                   name: str = EXPERT_NAME):

    """ Route between question and answer """
    
    # Get messages
    messages = state["messages"]
    max_num_turns = state.get('max_num_turns',DEFAULT_MAX_TURNS)

    # Check the number of expert answers 
    num_responses = len(
        [m for m in messages if isinstance(m, AIMessage) and m.name == name]
    )

    # End if expert has answered more than the max turns
    if num_responses >= max_num_turns:
        return 'save_interview'

    # This router is run after each question - answer pair
    # Get the last question asked to check if it signals the end of discussion
    last_question = messages[-2]

    if INTERVIEW_END_PHRASE in last_question.content:
        return 'save_interview'
    return "ask_question"

# Write a summary (section of the final report) of the interview
section_writer_instructions = """You are an expert technical writer creating one section of a research report.

Analyst focus area: {focus}

Write the section in this structure using markdown:
- ## Engaging title tied to the focus area
- ### Summary — brief background, then emphasize novel or surprising insights from the interview. ~{section_max_words} words. Cite sources inline as [1], [2], etc. Do not name interviewers or experts.
- ### Sources — every source used, one per line, full URL or document path. No duplicates.

Source format:
### Sources
[1] Link or Document name
[2] Link or Document name

No preamble before the title."""

def write_section(state: InterviewState):

    """ Node to write a section """

    # Get state
    interview = state["interview"]
    context = state["context"]
    analyst = state["analyst"]

    # Write section using either the gathered source docs from interview (context) or the interview itself (interview)
    system_message = section_writer_instructions.format(focus=analyst.description, section_max_words=SECTION_MAX_WORDS)
    section = llm.invoke([SystemMessage(content=system_message)]+[HumanMessage(content=f"Use this source to write your section: {context}")])

    # Append it to state
    return {"sections": [section.content]}

# Add nodes and edges 
interview_builder = StateGraph(InterviewState)
interview_builder.add_node("ask_question", generate_question)
interview_builder.add_node("search_web", partial(search_web, llm=llm))
interview_builder.add_node("search_wikipedia", partial(search_wikipedia, llm=llm))
interview_builder.add_node("answer_question", generate_answer)
interview_builder.add_node("save_interview", save_interview)
interview_builder.add_node("write_section", write_section)

# Flow
interview_builder.add_edge(START, "ask_question")
interview_builder.add_edge("ask_question", "search_web")
interview_builder.add_edge("ask_question", "search_wikipedia")
interview_builder.add_edge("search_web", "answer_question")
interview_builder.add_edge("search_wikipedia", "answer_question")
interview_builder.add_conditional_edges("answer_question", route_messages,['ask_question','save_interview'])
interview_builder.add_edge("save_interview", "write_section")
interview_builder.add_edge("write_section", END)

def begin_all_interviews(state: ResearchGraphState):
    """ Conditional edge to initiate all interviews via Send() API or return to create_analysts """    

    # Check if human feedback
    human_analyst_feedback=state.get('human_analyst_feedback','yes')
    if human_analyst_feedback.lower() != 'yes':
        # Return to create_analysts
        return "create_analysts"

    # Otherwise kick off interviews in parallel via Send() API
    else:
        analysts = state.get("analysts")
        if not analysts:
            return "create_analysts"
        topic = state["topic"]
        return [Send("conduct_interview", {"analyst": analyst,
                                           "messages": [HumanMessage(
                                               content=f"So you said you were writing an article on {topic}?"
                                           )
                                                       ]}) for analyst in analysts]

# Write a report based on the interviews
report_writer_instructions = """You are a technical writer synthesizing analyst memos into a report on: {topic}

Each memo captures findings from an expert interview on a specific sub-topic.

Your task: weave the central ideas from all memos into a single cohesive narrative.

Format:
- Markdown only, no preamble, no sub-headings.
- Open with ## Insights
- Preserve all inline citations from the memos ([1], [2], etc.)
- Close with a consolidated ## Sources section — ordered, no duplicates.

[1] Source 1
[2] Source 2

Memos: {context}"""

def write_report(state: ResearchGraphState):

    """ Node to write the final report body """

    # Full set of sections
    sections = state["sections"]
    topic = state["topic"]

    # Concat all sections together
    formatted_str_sections = "\n\n".join([f"{section}" for section in sections])
    
    # Summarize the sections into a final report
    system_message = report_writer_instructions.format(topic=topic, context=formatted_str_sections)    
    report = llm.invoke([SystemMessage(content=system_message)]+[HumanMessage(content=f"Write a report based upon these memos.")]) 
    return {"content": report.content}

# Write the introduction or conclusion
intro_conclusion_instructions = """You are a technical writer finishing a report on {topic}

You will be given all of the sections of the report.

Your job is to write the introduction or conclusion as instructed. No preamble.

Target ~{intro_conclusion_target_words} words: preview the sections (introduction) or recap their key takeaways (conclusion).

Use markdown formatting.
- Introduction: lead with a compelling # title, then ### Introduction
- Conclusion: use ### Conclusion

Sections to draw from: {formatted_str_sections}"""

def write_introduction(state: ResearchGraphState):
    """ Node to write the introduction """

    # Full set of sections
    sections = state["sections"]
    topic = state["topic"]

    # Concat all sections together
    formatted_str_sections = "\n\n".join([f"{section}" for section in sections])

    # Summarize the sections into a final report

    instructions = intro_conclusion_instructions.format(topic=topic, formatted_str_sections=formatted_str_sections, intro_conclusion_target_words=INTRO_CONCLUSION_TARGET_WORDS)
    intro = llm.invoke([instructions]+[HumanMessage(content=f"Write the report introduction")])
    return {"introduction": intro.content}

def write_conclusion(state: ResearchGraphState):
    """ Node to write the conclusion """

    # Full set of sections
    sections = state["sections"]
    topic = state["topic"]

    # Concat all sections together
    formatted_str_sections = "\n\n".join([f"{section}" for section in sections])

    # Summarize the sections into a final report

    instructions = intro_conclusion_instructions.format(topic=topic, formatted_str_sections=formatted_str_sections, intro_conclusion_target_words=INTRO_CONCLUSION_TARGET_WORDS)
    conclusion = llm.invoke([instructions]+[HumanMessage(content=f"Write the report conclusion")])
    return {"conclusion": conclusion.content}

def finalize_report(state: ResearchGraphState):
    """ The is the "reduce" step where we gather all the sections, combine them, and write the intro/conclusion """

    # Save full final report
    content = state["content"]
    if content.startswith(REPORT_INSIGHTS_HEADER):
        content = content.strip(REPORT_INSIGHTS_HEADER)
    if "## Sources" in content:
        try:
            content, sources = content.split(REPORT_SOURCES_SEPARATOR)
        except:
            sources = None
    else:
        sources = None

    final_report = state["introduction"] + REPORT_SEPARATOR + content + REPORT_SEPARATOR + state["conclusion"]
    if sources is not None:
        final_report += REPORT_SOURCES_SEPARATOR + sources
    return {"final_report": final_report}

# Add nodes and edges 
builder = StateGraph(ResearchGraphState)
builder.add_node("create_analysts", create_analysts)
builder.add_node("human_feedback", human_feedback)
builder.add_node("conduct_interview", interview_builder.compile())
builder.add_node("write_report", write_report)
builder.add_node("write_introduction",write_introduction)
builder.add_node("write_conclusion",write_conclusion)
builder.add_node("finalize_report", finalize_report)

# Logic
builder.add_edge(START, "create_analysts")
builder.add_edge("create_analysts", "human_feedback")

builder.add_conditional_edges("human_feedback", begin_all_interviews, ["create_analysts", "conduct_interview"])

builder.add_edge("conduct_interview", "write_report")
builder.add_edge("conduct_interview", "write_introduction")
builder.add_edge("conduct_interview", "write_conclusion")
builder.add_edge(["write_conclusion", "write_report", "write_introduction"], "finalize_report")
builder.add_edge("finalize_report", END)

# Compile
graph = builder.compile(interrupt_before=['human_feedback'])