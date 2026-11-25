import sys
from pathlib import Path


MAX_LINE_LENGTH = 1200


def main(filenames: list[str]) -> int:
    failed = False
    for filename in filenames:
        with Path(filename).open(encoding="utf-8") as source:
            for line_number, line in enumerate(source, start=1):
                length = len(line.rstrip("\n"))
                if length > MAX_LINE_LENGTH:
                    print(f"{filename}:{line_number}: {length} characters (limit {MAX_LINE_LENGTH})")
                    failed = True
    return int(failed)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
