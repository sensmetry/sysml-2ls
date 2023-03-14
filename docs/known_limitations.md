# Known Limitations

While the parser is LL(*), it may fail to parse some more complex language
constructs that require lookahead outside the context of a parser rule:

* Some expressions may fail to parse, i.e. feature reference expressions
* Namespace (`::` and `*`) and recursive (`::` and `**`) import tokens cannot be
  parsed separated by whitespace
* `assign` cannot have feature chains or expressions on the left side in SysML
