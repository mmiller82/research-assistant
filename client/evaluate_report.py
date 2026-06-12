#!/usr/bin/env python3
"""
LLM-as-judge evaluator for Research Assistant reports.

Reads a research report and scores it against the original topic across
multiple quality dimensions using a lightweight model.

Usage:
    python evaluate_report.py "AI safety risks" --report report.md
    python evaluate_report.py "quantum computing" < report.md
    python evaluate_report.py "climate tech" --report report.md --model gpt-3.5-turbo
    python evaluate_report.py "climate tech" --report report.md --min-score 20

Dependencies (already in agent environment):
    langchain-openai, pydantic, python-dotenv
"""

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI

load_dotenv(Path(__file__).parent.parent / "agent" / ".env")

DEFAULT_MODEL = "gpt-4o-mini"
MAX_SCORE = 30  # 6 dimensions × 5 points each


class DimensionScore(BaseModel):
    score: int = Field(description="Score from 1 to 5", ge=1, le=5)
    reasoning: str = Field(description="One or two sentences explaining the score")


class ReportEvaluation(BaseModel):
    relevance: DimensionScore = Field(
        description="How directly and fully the report addresses the stated topic"
    )
    accuracy: DimensionScore = Field(
        description="Factual correctness and quality of supporting evidence"
    )
    completeness: DimensionScore = Field(
        description="Breadth and depth of coverage across the topic's key sub-themes"
    )
    clarity: DimensionScore = Field(
        description="Organization, readability, and coherence of the writing"
    )
    insight_depth: DimensionScore = Field(
        description="Non-obvious findings and original analysis beyond surface-level facts"
    )
    source_quality: DimensionScore = Field(
        description="Credibility, diversity, and relevance of cited sources"
    )
    summary: str = Field(description="2-3 sentence overall assessment of the report")
    strengths: list[str] = Field(description="Top 3 strengths of the report")
    weaknesses: list[str] = Field(description="Top 3 areas for improvement")


JUDGE_PROMPT = """\
You are an expert research evaluator. Evaluate the research report below written on the topic: "{topic}"

Score each dimension from 1 (poor) to 5 (excellent):

  Relevance      — Does the report directly and fully address the stated topic?
  Accuracy       — Are claims factually supported and properly cited?
  Completeness   — Does it cover the topic's key sub-themes and nuances?
  Clarity        — Is the writing well-organized and easy to follow?
  Insight Depth  — Does it surface non-obvious findings beyond surface-level facts?
  Source Quality — Are sources credible, diverse, and relevant?

Also provide a 2-3 sentence summary, the top 3 strengths, and the top 3 areas for improvement.

--- REPORT START ---
{report}
--- REPORT END ---
"""


def evaluate(topic: str, report: str, model: str) -> ReportEvaluation:
    llm = ChatOpenAI(model=model, temperature=0)
    return llm.with_structured_output(ReportEvaluation).invoke(
        JUDGE_PROMPT.format(topic=topic, report=report)
    )


def overall_score(result: ReportEvaluation) -> int:
    return (
        result.relevance.score
        + result.accuracy.score
        + result.completeness.score
        + result.clarity.score
        + result.insight_depth.score
        + result.source_quality.score
    )


def _print_evaluation(topic: str, result: ReportEvaluation, model: str) -> None:
    print(f"\n{'═' * 72}")
    print(f"  LLM-as-Judge Evaluation")
    print(f"  Topic : {topic}")
    print(f"  Judge : {model}")
    print(f"{'═' * 72}\n")

    dimensions = [
        ("Relevance",      result.relevance),
        ("Accuracy",       result.accuracy),
        ("Completeness",   result.completeness),
        ("Clarity",        result.clarity),
        ("Insight Depth",  result.insight_depth),
        ("Source Quality", result.source_quality),
    ]
    for label, dim in dimensions:
        print(f"  {label:<16} {dim.score}/5")
        print(f"               {dim.reasoning}\n")

    total = overall_score(result)
    print(f"  {'Overall':<16} {total}/{MAX_SCORE}")
    print(f"\nSummary:\n  {result.summary}")

    print("\nStrengths:")
    for s in result.strengths:
        print(f"  + {s}")

    print("\nWeaknesses:")
    for w in result.weaknesses:
        print(f"  - {w}")

    print(f"\n{'═' * 72}\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="LLM-as-judge evaluator for Research Assistant reports",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("topic", help="The research topic the report was generated for")
    parser.add_argument(
        "--report", "-r",
        metavar="FILE",
        help="Path to the report file. Reads from stdin if omitted.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help="OpenAI model to use as the judge",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        metavar="N",
        help=f"Exit with code 1 if the overall score is below this threshold (1-{MAX_SCORE})",
    )
    args = parser.parse_args()

    if args.min_score is not None and not (1 <= args.min_score <= MAX_SCORE):
        parser.error(f"--min-score must be between 1 and {MAX_SCORE}")

    if args.report:
        report = Path(args.report).read_text(encoding="utf-8")
    else:
        if sys.stdin.isatty():
            print("Paste report then press Ctrl+D:")
        report = sys.stdin.read()

    if not report.strip():
        print("Error: report is empty.", file=sys.stderr)
        sys.exit(1)

    print(f"Evaluating report on '{args.topic}' using {args.model}...")
    result = evaluate(args.topic, report, args.model)
    _print_evaluation(args.topic, result, args.model)

    if args.min_score is not None:
        total = overall_score(result)
        if total < args.min_score:
            print(
                f"FAIL: overall score {total}/{MAX_SCORE} is below minimum {args.min_score}.",
                file=sys.stderr,
            )
            sys.exit(1)


if __name__ == "__main__":
    main()
