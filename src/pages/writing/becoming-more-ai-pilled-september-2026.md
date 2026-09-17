---
layout: ../../layouts/PostLayout.astro
title: becoming more ai pilled september '26
date: 2026-09-17
description: mcp servers, plugins, skills, subagents
---
I've spent the majority of my post-grad career tinkering on personal projects through my Claude Max subscription or at Stripe, where we spin up "minions" on go/orbit (i.e. internal systems that are already integrated with the MCP tools, skills, etc. specific to Stripe's codebase). For the latter, I never needed to extend my AI education beyond internal Slack channels or email updates. For the former, I never seemed to max out my plan so "optimizations" seemed unnecessary to me. 

It was when I started tinkering with [Conductor](https://conductor.build) that I started getting increasingly invested in the different tools, configurations, and optimizations that agents now offer. This article is my personal notes section on becoming more AI-pilled. 

- `/model` - Sonnet is the default model for most tasks, Haiku is for simple tasks or generating data, and Opus for more difficult tasks 
- `/compact` - Summarize the current conversation to keep going with the current session and cut down on context 
- `CLAUDE.md` can sit in `.claude` but it usually sits in the top repo directory for ease. Note that `AGENTS.md` is the vendor-neutral equivalent of `CLAUDE.md` 
- shift + tab to change modes on Claude 

## General 

### MCP Servers 
- Add via `/mcp` which you can add at local, project, or user level. Anything specific to a project will be added to the `.claude` folder in that project directory. These include files such as `settings.local.json` which offers permissions, env variables, etc. but are git-ignored. This directory also has a `/agents` subdirectory defining the agents that are spun up, and a `/skills` directory defining the skills pertinent to this project. Note that for the MCP tools, these tools are actually added to `~/.claude.json` rather than `.claude` as a subdirectory. 
- The easiest way to add an MCP server is through the CLI `claude mcp add ...`. You can scope the add via `--scope` to `local` (by default so available to you on this project), `project` (everyone in the project), or `user` (available to you across all projects) 

### Plugins 
- Plugins are installable bundles that extend the harness with new capabilities. They are packages pre-made for your set-up that are added to your `.claude` directory. A plugin generates a folder that can have other MCP tools, sub agents, skills, etc. For example, Conductor has a Vercel plugin that provides you access to all of Vercel's skills and any MCP tools that would be beneficial to use.
- You can easily disable plugins via `/plugin`, as it eats up your context on every turn. 

### Skills 
- Skills are learned behaviors from Claude that are similar to workflows and repeatable tasks in files (these are not actions or tools that Claude can take). Note these are on a project level or global level, and you should specify which is which. 
- Once you define a skill (ie. `.claude/skills/code-review/SKILL.md`), you can utilize the skill via `/code-review` in the terminal 

### Subagents 
- Subagent is another AI agent with its own context window running outside of your main Claude code session (ie. "delegate task to subagent"). 
- Agents are far more flexible and general (than skills) so they will follow the system prompt and persona that you have given them while skills are generally a workflow that an agent might use 
- You can also create custom sub agents that you give a set of instructions to have it follow every time it is spun up. You will want to type `/agents` in Claude, Create new agent, select whether you want it to be on a Project-level (ie. `.claude/agents/`) or Personal-level (ie. `~/.claude/agents/`) 
- Subagents will inherit the tools from the main agent but you can specify the tools and mcp servers that you want to scope only to a sub agent

### Memory Architecture 
- There is no persistent memory across sessions. A `CLAUDE.md` or `AGENTS.md` file will automatically be read in at the start of every session (project and global level). 






