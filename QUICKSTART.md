# Quick Start Guide - PraisonAI Bench TypeScript Plugin

## ✅ Installation Complete!

Your TypeScript evaluator plugin is fully set up and ready to use.

## 📂 Project Structure

```
praisonaibench-typescript/
├── src/                          # Plugin source code
│   ├── index.ts                  # Plugin exports
│   ├── evaluator.ts              # Main evaluator class
│   └── version.ts                # Version info
├── tests/                        # Comprehensive tests
│   ├── evaluator.test.ts         # Unit tests
│   └── integration.test.ts       # Integration tests
├── examples/                     # Example test suites
│   ├── simple_tests.yaml         # Basic TypeScript tests
│   ├── advanced_tests.yaml       # Complex challenges
│   └── algorithm_tests.yaml      # Algorithm tests
├── .env.example                  # Configuration template
├── package.json                  # Project config
├── tsconfig.json                 # TypeScript config
├── jest.config.js                # Test config
├── README.md                     # Full documentation
├── LICENSE                       # MIT License
└── .gitignore                    # Git ignore rules
```

## 🚀 Quick Test

### 1. Install Dependencies

```bash
cd ~/praisonaibench-typescript

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Run Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### 3. Test Programmatically

```typescript
import { TypeScriptEvaluator } from './src';

// Create evaluator
const evaluator = new TypeScriptEvaluator();

// Evaluate code
const result = await evaluator.evaluate(
  'console.log("Hello World")',
  "hello",
  "Print Hello World",
  "Hello World"
);

console.log(`Score: ${result.score}/100`);
console.log(`Passed: ${result.passed}`);
```

### 4. Run Example Tests

```bash
# Run simple tests
praisonaibench --suite examples/simple_tests.yaml --model gpt-4o-mini

# Run advanced tests
praisonaibench --suite examples/advanced_tests.yaml --model gpt-4o-mini

# Run algorithm tests
praisonaibench --suite examples/algorithm_tests.yaml --model gpt-4o-mini
```

## 🔑 Configuration

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Configure:
- ✅ OpenAI API Key
- ✅ Default Model: gpt-4o-mini
- ✅ Execution Timeout: 5 seconds

## 🎯 What's Included

### Core Features
- ✅ Syntax validation (TypeScript compiler API)
- ✅ Safe code execution (ts-node subprocess with timeout)
- ✅ Output comparison (fuzzy matching)
- ✅ Detailed feedback and scoring

### Security
- ✅ Subprocess isolation
- ✅ Timeout protection
- ✅ Resource limits
- ✅ Error handling

### Testing
- ✅ Comprehensive unit tests
- ✅ Integration tests
- ✅ Multiple test scenarios
- ✅ Edge case coverage

### Documentation
- ✅ Comprehensive README
- ✅ API documentation
- ✅ Usage examples
- ✅ Integration guide

## 📝 Example Test Suite

Create `my_tests.yaml`:

```yaml
tests:
  - name: "hello_world"
    language: "typescript"
    prompt: "Write TypeScript code that prints 'Hello World'"
    expected: "Hello World"
  
  - name: "fibonacci"
    language: "typescript"
    prompt: "Calculate the 10th Fibonacci number"
    expected: "55"
```

Run it:

```bash
praisonaibench --suite my_tests.yaml --model gpt-4o-mini
```

## 🔧 Customisation

### Custom Timeout

```typescript
const evaluator = new TypeScriptEvaluator(10); // 10 seconds
```

### Custom ts-node Executable

```typescript
const evaluator = new TypeScriptEvaluator(
  5,
  "/path/to/ts-node"
);
```

## 📚 Next Steps

1. **Read the full README**: `README.md` for detailed documentation
2. **Explore examples**: Check `examples/` for more test suites
3. **Run tests**: `npm test` to see all tests in action
4. **Create your tests**: Write custom test suites for your needs

## 🎉 Success Indicators

✅ Plugin installed successfully  
✅ All tests passing  
✅ Plugin discovered by PraisonAI Bench  
✅ Ready for production use  

## 📞 Support

- **Documentation**: See `README.md`
- **Examples**: Check `examples/` directory
- **Tests**: Run `npm test`
- **Issues**: Report on GitHub

---

**Your TypeScript evaluator plugin is fully operational! 🚀**
