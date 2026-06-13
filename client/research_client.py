#!/usr/bin/env python3
"""
Python client for the Research Assistant LangGraph workflow.

Usage:
    python research_client.py "AI safety risks"
    python research_client.py "quantum computing" --analysts 5 --output report.md
    python research_client.py "climate tech" --url http://localhost:8123 --accept

Dependencies:
    pip install -r requirements.txt
"""

import asyncio
import argparse
import sys
from pathlib import Path

from langgraph_sdk import get_client

GRAPH_NAME = "research_assistant"
DEFAULT_URL = "http://localhost:8123"
DEFAULT_MAX_ANALYSTS = 3


def _print_analysts(analysts: list) -> None:
    for a in analysts:
        name = a.get("name", "Unknown")
        role = a.get("role", "")
        affiliation = a.get("affiliation", "")
        description = a.get("description", "")
        print(f"  • {name} — {role}, {affiliation}")
        if description:
            truncated = description[:120] + ("..." if len(description) > 120 else "")
            print(f"    {truncated}")


async def _stream_run(
    client,
    thread_id: str,
    *,
    input_data: dict | None = None,
    command: dict | None = None,
) -> tuple[bool, str | None]:
    """Stream a run until completion or interrupt.

    Returns (was_interrupted, final_report).
    """
    was_interrupted = False
    final_report = None
    is_resume = command is not None

    kwargs: dict = {"stream_mode": "updates"}
    if input_data is not None:
        kwargs["input"] = input_data
    if command is not None:
        kwargs["command"] = command

    async for chunk in client.runs.stream(thread_id, GRAPH_NAME, **kwargs):
        if chunk.event == "error":
            print(f"\n[error] {chunk.data}", file=sys.stderr)
            break
        if chunk.event != "updates" or not chunk.data:
            continue

        for node_name, node_data in chunk.data.items():
            if node_name == "create_analysts":
                analysts = node_data.get("analysts", [])
                label = "Re-created" if is_resume else "Created"
                print(f"\n[create_analysts] {label} {len(analysts)} analyst(s):")
                _print_analysts(analysts)

            elif node_name == "__interrupt__":
                print("\n[interrupt] Graph paused — review the analysts above.")
                was_interrupted = True

            elif node_name == "human_feedback":
                print("[human_feedback] Processing feedback...")

            elif node_name == "conduct_interview":
                print("[conduct_interview] Conducting parallel interviews...")

            elif node_name == "write_report":
                print("[write_report] Writing report body...")

            elif node_name == "write_introduction":
                print("[write_introduction] Writing introduction...")

            elif node_name == "write_conclusion":
                print("[write_conclusion] Writing conclusion...")

            elif node_name == "finalize_report":
                final_report = node_data.get("final_report")
                print("[finalize_report] Report finalized.")

    return was_interrupted, final_report


def _prompt_feedback() -> str:
    print('\nEnter feedback to revise the analysts, or press Enter / type "yes" to proceed:')
    value = input("> ").strip()
    return value if value else "yes"


def _write_report(report: str, output_file: str | None) -> None:
    if output_file:
        path = Path(output_file)
        path.write_text(report, encoding="utf-8")
        print(f"\nReport saved → {path.resolve()}")
    else:
        print("\n" + "─" * 72)
        print(report)
        print("─" * 72)


async def run(topic: str, max_analysts: int, url: str, output_file: str | None, accept: bool) -> None:
    client = get_client(url=url)

    thread = await client.threads.create()
    thread_id = thread["thread_id"]

    print(f"Thread:   {thread_id}")
    print(f"Topic:    {topic}")
    print(f"Analysts: {max_analysts}\n")
    print("Starting research...\n")

    # Initial run — graph runs create_analysts then pauses at human_feedback interrupt
    interrupted, final_report = await _stream_run(
        client,
        thread_id,
        input_data={"topic": topic, "max_analysts": max_analysts},
    )

    # Human-in-the-loop: loop until the user accepts the analysts ("yes")
    while interrupted:
        if accept:
            print("\n[--accept] Automatically accepting analysts.")
            feedback = "yes"
        else:
            feedback = _prompt_feedback()

        # Mirror the JS frontend: update thread state before resuming so
        # begin_all_interviews reads the correct human_analyst_feedback value.
        await client.threads.update_state(
            thread_id,
            values={"human_analyst_feedback": feedback},
        )
        interrupted, final_report = await _stream_run(
            client,
            thread_id,
            command={"resume": feedback},
        )

    if final_report:
        _write_report(final_report, output_file)
    else:
        print("\nNo report received.", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Python client for the Research Assistant LangGraph workflow",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("topic", help="Research topic to investigate")
    parser.add_argument(
        "--analysts",
        type=int,
        default=DEFAULT_MAX_ANALYSTS,
        metavar="N",
        help="Number of analyst personas to create",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help="LangGraph API base URL",
    )
    parser.add_argument(
        "--output",
        "-o",
        metavar="FILE",
        help="Save the final report to a file (markdown) instead of printing",
    )
    parser.add_argument(
        "--accept",
        action="store_true",
        help="Automatically accept the generated analysts without prompting",
    )
    args = parser.parse_args()

    asyncio.run(run(args.topic, args.analysts, args.url, args.output, args.accept))


if __name__ == "__main__":
    main()
