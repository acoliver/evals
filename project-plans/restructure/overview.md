# Evaluation Restructure: Unified Runner + Configuration-Based System

##  **PROBLEM STATEMENT**

###  **Current Issues**
1. **Massive Code Duplication**: 6 evaluation scripts with ~2,200 lines of duplicated code
2. **Hardcoded CLI Configuration**: Model settings scattered across every script
3. **Maintenance Overhead**: Adding new evaluations requires copying 350+ line scripts
4. **Inflexible Testing**: No easy way to run specific configurations or quick iterations
5. **Command Mapping Gap**: Build step names have no mapping to actual commands
6. **Path Resolution Issues**: Relative paths fragile for workspace locations

###  **Goals**
1. **Single unified runner** for all evaluations
2. **Configuration-driven system** for CLI/models/evaluations
3. **Easy addition** of new models, evaluations, and configurations
4. **Maintainability** and extensibility
5. **Complete migration**: Big bang approach, no backward compatibility needed

---

##  **NEW ARCHITECTURE**

###  **Configuration Philosophy**
**"Configuration = CLI tool + Model + Settings + Temp"**

- `llxprt-synthetic-glm4.6-temp1` = LLxprt CLI + synthetic profile + GLM-4.6 model + temperature 1.0
- `cerebrasqwen3-qwen3-coder-temp1` = LLxprt CLI + cerebrasqwen3 profile + Qwen3 Coder model + temperature 1.0
- `codex-exec-gpt5-default` = Codex CLI + exec mode + GPT-5 model + default settings

###  **Configuration Structure**

#### **Config File**: `evals/config/cli-config.json`
```json
{
  "configurations": {
    "llxprt-synthetic-glm4.6-temp1": {
      "cli": "llxprt",
      "name": "LLxprt Code/Synthetic GLM 4.6, Temp 1",
      "description": "LLxprt running synthetic profile with GLM-4.6 model at temperature 1.0",
      "args": ["--profile-load", "synthetic", "--yolo"],
      "timeout": 1800000
    },
    "cerebrasqwen3-qwen3-coder-temp1": {
      "cli": "llxprt", 
      "name": "Cerebras Qwen 3 480B, Temp 1",
      "description": "LLxprt running cerebrasqwen3 profile with Qwen3 Coder at temperature 1.0",
      "args": ["--profile-load", "cerebrasqwen3", "--yolo"],
      "timeout": 1800000
    },
    "codex-exec-gpt5-default": {
      "cli": "codex",
      "name": "Codex/GPT-5-Codex, Default Settings",
      "description": "Codex with full system access using existing arguments",
      "args": ["exec", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"],
      "timeout": 600000
    }
  },
  "defaultConfigurations": [
    "llxprt-synthetic-glm4.6-temp1",
    "cerebrasqwen3-qwen3-coder-temp1", 
    "codex-exec-gpt5-default"
  ]
}
```

#### **Evaluation Config**: `evals/config/eval-config.json`
```json
{
  "evaluations": {
    "base64-fix": {
      "workspace": "${EVAL_ROOT}/problems/base64-fix/workspace",
      "grading": "${EVAL_ROOT}/grading/base64-fix",
      "prompt": "base64-fix.md",
      "buildSteps": ["typecheck", "lint", "test:public"],
      "gradeSteps": ["lint", "typecheck", "test:hidden"]
    },
    "form-capture": {
      "workspace": "${EVAL_ROOT}/problems/form-capture/workspace",
      "grading": "${EVAL_ROOT}/grading/form-capture",
      "prompt": "form-capture.md", 
      "buildSteps": ["lint", "test:public", "typecheck", "build"],
      "gradeSteps": ["workspace-install", "typecheck", "test:hidden"]
    },
    "pagination": {
      "workspace": "${EVAL_ROOT}/problems/pagination/workspace",
      "grading": "${EVAL_ROOT}/grading/pagination",
      "prompt": "pagination.md",
      "buildSteps": ["typecheck", "lint", "test:public"],
      "gradeSteps": ["lint", "typecheck", "test:hidden"]
    },
    "react-evaluation": {
      "workspace": "${EVAL_ROOT}/problems/react-evaluation/workspace", 
      "grading": "${EVAL_ROOT}/grading/react-evaluation",
      "prompt": "reactive-programming.md",
      "buildSteps": ["lint", "test:public", "typecheck", "build"],
      "gradeSteps": ["workspace-install", "typecheck", "test:hidden"]
    },
    "regex-challenge": {
      "workspace": "${EVAL_ROOT}/problems/regex-challenge/workspace",
      "grading": "${EVAL_ROOT}/grading/regex-challenge", 
      "prompt": "regex-challenge.md",
      "buildSteps": ["lint", "test:public", "typecheck", "build"],
      "gradeSteps": ["workspace-install", "typecheck", "test:hidden"]
    },
    "report-builder": {
      "workspace": "${EVAL_ROOT}/problems/report-builder/workspace",
      "grading": "${EVAL_ROOT}/grading/report-builder",
      "prompt": "report-builder.md",
      "buildSteps": ["typecheck", "lint", "test:public", "build"], 
      "gradeSteps": ["lint", "typecheck", "test:hidden"]
    }
  }
}
```

#### **Command Registry**: `evals/config/command-registry.json`
```json
{
  "typecheck": {"command": "npm", "args": ["run", "typecheck"], "timeout": 60000},
  "lint": {"command": "npm", "args": ["run", "lint"], "timeout": 120000},
  "test:public": {"command": "npm", "args": ["run", "test:public"], "timeout": 180000},
  "build": {"command": "npm", "args": ["run", "build"], "timeout": 120000},
  "workspace-install": {"command": "npm", "args": ["install"], "timeout": 300000},
  "test:hidden": {"command": "npm", "args": ["run", "test:hidden"], "timeout": 300000}
}
```

---

##  **UNIFIED RUNNER DESIGN**

###  **New Entry Point**: `evals/run-evals.ts`

#### **Usage Examples**
```bash
# Run all evaluations with default configurations
npx ts-node evals/run-evals.ts

# Run single evaluation with all configurations  
npx ts-node evals/run-evals.ts --eval base64-fix

# Run single configuration across all evaluations
npx ts-node evals/run-evals.ts --config llxprt-synthetic-glm4.6-temp1

# Run specific evaluation + configuration combo
npx ts-node evals/run-evals.ts --eval regex-challenge --config codex-exec-gpt5-default

# Multiple configurations  
npx ts-node evals/run-evals.ts --config llxprt-synthetic-glm4.6-temp1,cerebrasqwen3-qwen3-coder-temp1
```

#### **Core Implementation Concept**
```typescript
interface Configuration {
  cli: string;                                    // "llxprt" | "codex"
  name: string;                                   // "LLxprt Code/Synthetic GLM 4.6, Temp 1"
  description?: string;                            // Detailed description
  args: string[];                                 // Actual CLI arguments
  timeout: number;                                // Timeout in ms
}

interface CommandDefinition {
  command: string;                               // "npm" | etc.
  args: string[];                                 // Command arguments
  timeout: number;                                // Timeout in ms
}

class ConfigurationManager {
  async runConfiguration(configId: string, promptInstruction: string, cwd: string) {
    const config = this.getConfig(configId);
    const args = [...config.args, promptInstruction];
    
    return await runCommand(configId, config.cli, args, {
      cwd,
      timeout: config.timeout
    });
  }
  
  runCommand(cwd: string, stepName: string) {
    const commandDef = this.commandRegistry[stepName];
    if (!commandDef) {
      throw new Error(`Unknown command step: ${stepName}`);
    }
    
    return await runCommand(commandDef.command, commandDef.args, {
      cwd,
      timeout: commandDef.timeout
    });
  }
}

class UnifiedRunner {
  async runEval(evalName: string, configId: string): Promise<EvalResult> {
    // 1. Load configs with EVAL_ROOT environment variable substitution
    const evalConfig = this.loadEvalConfig(evalName);
    const cliConfig = this.loadCLIConfig(configId);
    
    // 2. Setup workspace (absolute paths from evals/ directory)
    const workspace = await this.setupWorkspace(evalConfig.workspace);
    
    // 3. Write prompt to ./prompt.md in workspace
    await this.writePrompt(workspace, evalConfig.prompt);
    
    // 4. Run CLI tool in workspace directory
    await this.runCLIConfig(configId, 'Execute the instructions in ./prompt.md', workspace);
    
    // 5. Run build steps in workspace directory
    for (const step of evalConfig.buildSteps) {
      await this.runCommand(workspace, step);
    }
    
    // 6. Run grading steps in grading directory
    for (const step of evalConfig.gradeSteps) {
      await this.runCommand(evalConfig.grading, step);
    }
    
    // 7. Collect results
    return this.collectResults(evalName, configId, workspace);
  }
  
  private async setupWorkspace(workspacePath: string): Promise<string> {
    // Copy workspace template to temp directory
    // Substitute ${EVAL_ROOT} with actual path
    const resolvedPath = workspacePath.replace('${EVAL_ROOT}', __dirname);
    const workspaceCopy = await copyWorkspace(resolvedPath);
    return workspaceCopy;
  }
  
  private async writePrompt(workspace: string, promptFile: string): Promise<void> {
    // Load prompt components and write to ./prompt.md
    const problemPrompt = await readFile(path.join(__dirname, '../prompts/problems', promptFile), 'utf8');
    const problemDescription = await readFile(path.join(workspace, 'problem.md'), 'utf8');
    const sharedInstructions = await readFile(path.join(__dirname, '../prompts/shared/evaluation-instructions.md'), 'utf8');
    
    const prompt = [problemPrompt, problemDescription, sharedInstructions].join('\n\n');
    await writeFile(path.join(workspace, 'prompt.md'), prompt, 'utf8');
  }
  
  private async runCommand(cwd: string, commandName: string): Promise<CommandResult> {
    return await this.configurationManager.runCommand(cwd, commandName);
  }
  
  private async runCLIConfig(configId: string, instruction: string, cwd: string): Promise<CommandResult> {
    return await this.configurationManager.runConfiguration(configId, instruction, cwd);
  }
}
```

---

##  **KEY ARCHITECTURAL DECISIONS**

### **1. Global Command Registry**
- **Vitest only**: All evals use Vitest test framework
- **No parallel execution**: Sequential command execution for simplicity
- **Step name mapping**: Maps `typecheck`, `lint`, `test:public` etc. to actual npm commands
- **Timeout handling**: Each command has appropriate timeout limits

### **2. No Capability System**
- Removed complexity
- Trust configurations to match CLI capabilities  
- Simplifies validation and configuration management

### **3. Prompt System (Keep Current Working Approach)**
```typescript
// Write prompt to workspace, all CLIs read from their cwd
const prompt = [problemPrompt, problemDescription, sharedInstructions].join('\n\n');
await writeFile(path.join(workspaceCopy, 'prompt.md'), prompt, 'utf8');
const modelInstruction = 'Execute the instructions in ./prompt.md';
```
- All CLIs must support file access to participate
- Simple and consistent approach that works today
- CLI tools work within their isolated workspace

### **4. Codex Full Access**
- Use existing `--dangerously-bypass-approvals-and-sandbox` setup
- Codex without full access is useless for these evals
- No safety controls needed since we trust configurations

### **5. Absolute Path Resolution**
- Use `${EVAL_ROOT}` substitution for reliable path resolution
- Paths relative to evals/ directory: `evals/config/`, `evals/problems/`, `evals/grading`
- Eliminates fragility of `../` relative paths

### **6. Workspace Isolation**
- CLI starts in problem workspace directory: `/tmp/.../workspace-uuid/`
- CLI has access to: `./prompt.md`, `./src/`, `package.json`, etc.
- CLI cannot escape workspace: No directory traversal up or down
- Each evaluation run gets isolated temporary workspace

### **7. Big Bang Migration**
- No phased rollout or backward compatibility shims
- Complete replacement of existing scripts
- Replace all at once once system is verified working

---

##  **BENEFITS**

###  **Maintainability**
- **Code Reduction**: 2,200 lines → ~150 lines of core logic
- **Single Source of Truth**: All configurations in one place
- **Easy Updates**: Change CLI behavior = update config, not 6 scripts

###  **Flexibility**
- **Easy A/B Testing**: Compare temperature variants (`temp0.7` vs `temp1.0`)
- **Progressive Rollout**: Add new CLI versions alongside existing ones
- **Targeted Testing**: Run specific configurations for debugging

###  **Extensibility**
- **Add New CLI**: One entry in `cli-config.json`
- **Add New Eval**: One entry in `eval-config.json`  
- **Future-Proof**: Easy to support new tools like Claude, CodePuppy

---

##  **SEPARATION OF CONCERNS**

### **Harness Responsibility** (`run-evals.ts`):
- Orchestrate evaluation lifecycle
- Copy workspaces and manage temp directories
- Write prompt files and collect results
- Execute configured commands via command registry
- Time each phase and report results
- Path resolution and environment management

### **Workspace Responsibility** (`problems/*/workspace/`):
- Define own build process via `package.json` scripts
- Handle their own tooling (TypeScript, vitest, etc.)
- Provide the problem definition and constraints
- CLI tools work within these self-contained environments

### **Configuration Files**:
- Define what exists, not how it works
- Map step names to actual commands
- Specify CLI parameters and timeouts
- No logic - just data with path substitution

---

##  **MIGRATION STRATEGY**

### Big Bang Implementation:
1. **Phase 1**: Build Config Files and Unified Runner
   - Create all config files with current working parameters
   - Implement unified runner with proper path resolution
   - Implement command registry with step name mapping
   - Test with base64-fix evaluation to verify functionality

2. **Phase 2**: Full System Validation
   - Run ALL evaluations with ALL configurations
   - Verify identical results compared to current system
   - Fix any infra bugs discovered during validation

3. **Phase 3**: Complete Migration
   - Delete all old evaluation scripts
   - Commit unified system
   - Update documentation

### Implementation Order:
```bash
npx ts-node evals/run-evals.ts --eval base64-fix --config ALL
npx ts-node evals/run-evals.ts --eval ALL --config ALL  
rm evals/runBase64Fix.ts evals/runFormCapture.ts evals/runPagination.ts evals/runReact.ts evals/runRegexChallenge.ts evals/runReportBuilder.ts
git add -A && git commit -m "Replace 6 evaluation scripts with unified configuration-driven runner"
```

---

##  **NAMING CONVENTION**

### **Configuration Keys**: `cli-profile-model-temp-version`
- `llxprt-synthetic-glm4.6-temp1`
- `cerebrasqwen3-qwen3-coder-temp1`
- `codex-exec-gpt5-default`

### **Human-Readable Names**: Required field
- `LLxprt Code/Synthetic GLM 4.6, Temp 1`
- `Cerebras Qwen 3 480B, Temp 1` 
- `Codex/GPT-5-Codex, Default Settings`

### **Descriptions**: Optional detailed explanations

---

##  **NEXT STEPS**

1. Configuration files implemented in this branch
2. Core unified runner implementation with command registry
3. Path resolution with ${EVAL_ROOT} substitution
4. Testing and validation of new system
5. Complete migration with big bang approach

This restructure will transform the evaluation system from a maintenance-heavy monolith to a flexible, configuration-driven platform with proper command mapping and reliable path handling.