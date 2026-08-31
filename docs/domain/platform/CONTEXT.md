# Platform

Toolora is a Chinese-interface platform for independent online Tools. A Tool's inputs and outputs can target any search language supported by its data source.

## Language

**Tool**:
An independent utility that a visitor can use without an account. Tools share the Toolora shell and selected capabilities, not user-facing workflows or results.
_Avoid_: Product, plugin, mini-app

**Workspace**:
The current browser-local state of one Tool. Each Tool has at most one Workspace containing one current Analysis and no history.
_Avoid_: Project, account workspace, history

**Analysis**:
A coherent set of inputs being processed together inside a Workspace. Adding inputs expands the current Analysis; starting a new Analysis replaces it.
_Avoid_: Project, report, history item

**Provider**:
An external service that supplies data to one or more Tools. SerpAPI is the current SERP Provider.
_Avoid_: Backend, engine

**SerpAPI Settings**:
The browser-local configuration shared by Tools that use SerpAPI, including the Key Pool and its selection strategy.
_Avoid_: Account settings, user settings, Tool settings

**Key Pool**:
The visitor-provided SerpAPI keys available to a run. Toolora stores the pool only in the visitor's browser.
_Avoid_: Platform keys, server keys
