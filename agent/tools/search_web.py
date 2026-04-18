
from langchain_tavily import TavilySearch
from langchain_openai import ChatOpenAI
from common import InterviewState
from tools.seach_instructions import SearchQuery, search_instructions

def search_web(state: InterviewState, llm: ChatOpenAI):
    """ Retrieve docs from web search """

    # Search
    tavily_search = TavilySearch(max_results=3)

    # Search query
    structured_llm = llm.with_structured_output(SearchQuery)
    search_query = structured_llm.invoke([search_instructions]+state['messages'])
    
    # Search
    data = tavily_search.invoke({"query": search_query.search_query})
    search_docs = data.get("results", data)

     # Format
    formatted_search_docs = "\n\n---\n\n".join(
        [
            f'<Document href="{doc["url"]}"/>\n{doc["content"]}\n</Document>'
            for doc in search_docs
        ]
    )

    return {"context": [formatted_search_docs]} 
