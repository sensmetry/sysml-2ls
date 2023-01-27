# How to contribute

We are happy for you taking the time to contribute! We appreciate your help with feature implementation, bug fixes, unit tests, or just for reporting the issues and improvement ideas.

- [Main project repo](https://gitlab.com/sensmetry/public/sysml-2ls) is hosted on Gitlab, but we have a [mirrored repo](https://github.com/sensmetry/sysml-2ls) hosted on GitHub
- Developer instructions are available in the [README.md](README.md#developer-instructions)
- Project's main issue tracker is [here](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues) and this is the prefered place to post issues. Alternatively, you may post issues to the issue tracker of the [mirror repo](https://github.com/sensmetry/sysml-2ls/issues) on GitHub.
- To contact the maintainers of the project, feel free to send an email to (while making sure to CC all of the bellow):
  - Tilo Wiklund tilo.wiklund@sensmetry.com
  - Antanas Kalkauskas antanas.kalkauskas@sensmetry.com
  - Daumantas Kavolis daumantas.kavolis@sensmetry.com

## Environment details

Details on how to build and set up the project are available in the [README.md](README.md#developer-instructions).

## Testing

We use [Jest](https://jestjs.io/) for unit testing. We would always be happy to increase unit test coverage. Please write unit tests for new code that you create.

## Reporting bugs

You may report bugs to the issue tracker<!-- TODO: add link-->. To do so, please fill [this issue template](.gitlab/issue_templates/bug_report.md). 

## Submitting changes

Please create a merge request to our project's Gitlab repo<!-- TODO: add link-->. As a merge request description, please fill in the merge request description template [here](.gitlab/merge_request_templates/merge_request.md). We would be very grateful if you would include Jest unit tests for the added code.

Make sure that all of your commits are atomic (i. e. addressing not more than one feature per commit) and always write a clear message for your commits.

For branch names, use convention `fix/ISSUE_NUMBER-<FIX_SUMMARY>` for bug fixes and `feat/ISSUE_NUMBER-<FEAT_SUMMARY>` for feature implementations.

### Developer certificate of origin

Contributions to this repository are subject to the [Developer Certificate of Origin](DCO). All commits should be signed off by either using `-s` or `--signed` flag while committing:
```
git commit -s -m "My commit message"
```

Alternatively, you can add additional line to the commit message:

```
My commit message

Signed-off-by: Dev McDeveloper <Dev.McDeveloper@example.com>
```

## Suggesting features

You may post feature/enhancement requests on the project's issue tracker<!-- TODO: add link-->. To do so, please fill [this issue template](.gitlab/issue_templates/feature_request.md).

<!-- ## Coding conventions

(TODO: add info about styleguide and linting if needed) -->
