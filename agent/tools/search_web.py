"""Web search tool using Tavily."""
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_openai import ChatOpenAI
from common import InterviewState
from tools.search_instructions import SearchQuery, search_instructions

def search_web(state: InterviewState, llm: ChatOpenAI):
    """ Retrieve docs from web search """

    tavily_search = TavilySearchResults(max_results=3)

    structured_llm = llm.with_structured_output(SearchQuery)
    search_query = structured_llm.invoke([search_instructions]+state['messages'])

    search_docs = tavily_search.invoke(search_query.search_query)

    formatted_search_docs = "\n\n---\n\n".join(
        [
            f'<Document href="{doc["url"]}"/>\n{doc["content"]}\n</Document>'
            for doc in search_docs
        ]
    )

    return {"context": [formatted_search_docs]}
