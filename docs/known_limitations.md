# Known Limitations

While the parser is LL(*), it may fail to parse some more complex language
constructs that require lookahead outside the context of a parser rule:

* Some expressions may fail to parse, i.e. feature reference expressions
* Namespace (`::` and `*`) and recursive (`::` and `**`) import tokens cannot be
  parsed separated by whitespace
* `assign` cannot have feature chains or expressions on the left side in SysML
* SysML grammar is slightly relaxed for succession and transition usage elements
  so that they can appear anywhere in the body and are not constrained by the
  preceding and following elements
