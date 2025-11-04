#!/bin/bash

# Wrapper script for code-puppy that sets up the environment for various API keys
# This script ensures required API keys are set before calling code-puppy

# Load Cerebras API key if not already set
if [ -z "$CEREBRAS_API_KEY" ] && [ -z "$CEREBRAS_KEY" ]; then
    if [ -f ~/.cerebras_key ]; then
        export CEREBRAS_API_KEY="$(cat ~/.cerebras_key)"
    fi
fi

# If CEREBRAS_KEY is set but CEREBRAS_API_KEY isn't, use CEREBRAS_KEY
if [ -z "$CEREBRAS_API_KEY" ] && [ -n "$CEREBRAS_KEY" ]; then
    export CEREBRAS_API_KEY="$CEREBRAS_KEY"
fi

# Load Synthetic API key if not already set
if [ -z "$SYN_API_KEY" ] && [ -z "$SYNTHETIC_KEY" ]; then
    if [ -f ~/.synthetic_key ]; then
        export SYN_API_KEY="$(cat ~/.synthetic_key)"
    fi
fi

# If SYNTHETIC_KEY is set but SYN_API_KEY isn't, use SYNTHETIC_KEY
if [ -z "$SYN_API_KEY" ] && [ -n "$SYNTHETIC_KEY" ]; then
    export SYN_API_KEY="$SYNTHETIC_KEY"
fi

# Load ZAI API key if not already set
if [ -z "$ZAI_API_KEY" ] && [ -z "$ZAI_KEY" ]; then
    if [ -f ~/.zai2_key ]; then
        export ZAI_API_KEY="$(cat ~/.zai2_key)"
    fi
fi

# If ZAI_KEY is set but ZAI_API_KEY isn't, use ZAI_KEY
if [ -z "$ZAI_API_KEY" ] && [ -n "$ZAI_KEY" ]; then
    export ZAI_API_KEY="$ZAI_KEY"
fi

# Call code-puppy with all arguments passed through
exec code-puppy "$@"
