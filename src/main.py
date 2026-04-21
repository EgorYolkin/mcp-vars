from __future__ import annotations

import argparse
import sys

from dotenv import load_dotenv

from src.install.installer import (
    DEFAULT_SERVER_NAME,
    SUPPORTED_CLIENTS,
    format_install_report,
    install_configs,
)
from src.server.app import create_mcp


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    args = _build_parser().parse_args(argv)

    if args.command == "install":
        results = install_configs(
            clients=args.clients,
            server_name=args.server_name,
        )
        print(format_install_report(results))
        return 0

    mcp = create_mcp()
    mcp.run(transport="stdio")
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="mcp-vars")
    subparsers = parser.add_subparsers(dest="command")

    install_parser = subparsers.add_parser(
        "install",
        help="Register this MCP server in supported agent configs.",
    )
    install_parser.add_argument(
        "--clients",
        nargs="+",
        choices=SUPPORTED_CLIENTS,
        default=list(SUPPORTED_CLIENTS),
        help="Which clients to patch. Defaults to all supported clients.",
    )
    install_parser.add_argument(
        "--server-name",
        default=DEFAULT_SERVER_NAME,
        help="Server name written into client configs.",
    )
    return parser


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
