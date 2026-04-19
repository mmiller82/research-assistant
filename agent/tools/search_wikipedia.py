from langchain_openai import ChatOpenAI
from langchain_community.document_loaders import WikipediaLoader
from common import InterviewState
from tools.seach_instructions import SearchQuery, search_instructions


def search_wikipedia(state: InterviewState, llm: ChatOpenAI):
    """ Retrieve documents from wikipedia """

    # Query
    structured_llm = llm.with_structured_output(SearchQuery)
    search_query = structured_llm.invoke([search_instructions]+state['messages'])
    
    # Search
    search_docs = WikipediaLoader(query=search_query.search_query, 
                                  load_max_docs=2).load()

     # Format
    formatted_search_docs = "\n\n---\n\n".join(
        [
            f'<Document source="{doc.metadata["source"]}" page="{doc.metadata.get("page", "")}"/>\n{doc.page_content}\n</Document>'
            for doc in search_docs
        ]
    )

    return {"context": [formatted_search_docs]}