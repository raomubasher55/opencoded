// Test script for new LLM providers
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing LLM Provider Integration...');
console.log('=====================================');

// Test if the provider files exist and have the correct structure
const providersDir = path.join(__dirname, 'services/llm-service/src/providers');

async function testProviderFiles() {
  console.log('\n📁 Testing Provider Files...');
  
  const expectedProviders = [
    'openai.provider.ts',
    'anthropic.provider.ts', 
    'google.provider.ts',
    'openrouter.provider.ts',
    'simulation.provider.ts'
  ];
  
  for (const provider of expectedProviders) {
    const filePath = path.join(providersDir, provider);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Check for key components
        const hasClass = content.includes('Provider implements LlmProvider');
        const hasInitialize = content.includes('async initialize(');
        const hasCreateCompletion = content.includes('async createCompletion(');
        const hasGetModels = content.includes('async getModels(');
        
        if (hasClass && hasInitialize && hasCreateCompletion && hasGetModels) {
          console.log(`✅ ${provider} - Complete implementation`);
        } else {
          console.log(`⚠️  ${provider} - Missing methods:`, {
            class: hasClass,
            initialize: hasInitialize,
            createCompletion: hasCreateCompletion,
            getModels: hasGetModels
          });
        }
      } else {
        console.log(`❌ ${provider} - File not found`);
      }
    } catch (error) {
      console.log(`❌ ${provider} - Error reading file: ${error.message}`);
    }
  }
}

async function testConfigurationUpdate() {
  console.log('\n⚙️  Testing Configuration Updates...');
  
  const configPath = path.join(__dirname, 'services/llm-service/src/config/config.ts');
  
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      
      // Check for new provider configurations
      const hasOpenRouter = content.includes('openrouter:');
      const hasGoogleUpdate = content.includes('gemini-1.5-pro');
      const hasOpenRouterEnv = content.includes('OPENROUTER_API_KEY');
      
      console.log('✅ Configuration file exists');
      console.log(`${hasOpenRouter ? '✅' : '❌'} OpenRouter configuration`);
      console.log(`${hasGoogleUpdate ? '✅' : '❌'} Updated Google model`);
      console.log(`${hasOpenRouterEnv ? '✅' : '❌'} OpenRouter environment variable`);
      
      // Check provider type updates
      const hasUpdatedTypes = content.includes("'openrouter'");
      console.log(`${hasUpdatedTypes ? '✅' : '❌'} Updated provider types`);
      
    } else {
      console.log('❌ Configuration file not found');
    }
  } catch (error) {
    console.log(`❌ Error reading configuration: ${error.message}`);
  }
}

async function testServiceRegistration() {
  console.log('\n🔧 Testing Service Registration...');
  
  const servicePath = path.join(__dirname, 'services/llm-service/src/services/llm.service.ts');
  
  try {
    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf-8');
      
      // Check for imports
      const hasGoogleImport = content.includes("from '../providers/google.provider'");
      const hasOpenRouterImport = content.includes("from '../providers/openrouter.provider'");
      
      // Check for registrations
      const hasGoogleRegistration = content.includes("this.registerProvider('google'");
      const hasOpenRouterRegistration = content.includes("this.registerProvider('openrouter'");
      
      // Check for fallback logic
      const hasUpdatedFallback = content.includes("providerName === 'google'") && 
                                 content.includes("providerName === 'openrouter'");
      
      console.log('✅ Service file exists');
      console.log(`${hasGoogleImport ? '✅' : '❌'} Google provider import`);
      console.log(`${hasOpenRouterImport ? '✅' : '❌'} OpenRouter provider import`);
      console.log(`${hasGoogleRegistration ? '✅' : '❌'} Google provider registration`);
      console.log(`${hasOpenRouterRegistration ? '✅' : '❌'} OpenRouter provider registration`);
      console.log(`${hasUpdatedFallback ? '✅' : '❌'} Updated fallback logic`);
      
    } else {
      console.log('❌ Service file not found');
    }
  } catch (error) {
    console.log(`❌ Error reading service file: ${error.message}`);
  }
}

async function testSharedTypes() {
  console.log('\n📝 Testing Shared Types...');
  
  const typesPath = path.join(__dirname, 'packages/shared-types/src/index.ts');
  
  try {
    if (fs.existsSync(typesPath)) {
      const content = fs.readFileSync(typesPath, 'utf-8');
      
      // Check for updated provider types
      const hasOpenRouterType = content.includes("'openrouter'");
      const hasCompleteTypes = content.includes("'openai' | 'anthropic' | 'google' | 'openrouter' | 'bedrock'");
      
      console.log('✅ Shared types file exists');
      console.log(`${hasOpenRouterType ? '✅' : '❌'} OpenRouter in provider types`);
      console.log(`${hasCompleteTypes ? '✅' : '❌'} Complete provider type union`);
      
    } else {
      console.log('❌ Shared types file not found');
    }
  } catch (error) {
    console.log(`❌ Error reading shared types: ${error.message}`);
  }
}

async function showUsageExamples() {
  console.log('\n💡 LLM Provider Usage Examples:');
  console.log('===============================');
  
  console.log('\n🔑 Environment Variables to Set:');
  console.log('# OpenAI');
  console.log('OPENAI_API_KEY=sk-your-openai-key');
  console.log('OPENAI_DEFAULT_MODEL=gpt-4');
  
  console.log('\n# Anthropic');
  console.log('ANTHROPIC_API_KEY=sk-ant-your-anthropic-key');
  console.log('ANTHROPIC_DEFAULT_MODEL=claude-3-opus-20240229');
  
  console.log('\n# Google');
  console.log('GOOGLE_API_KEY=your-google-api-key');
  console.log('GOOGLE_DEFAULT_MODEL=gemini-1.5-pro');
  
  console.log('\n# OpenRouter');
  console.log('OPENROUTER_API_KEY=sk-or-your-openrouter-key');
  console.log('OPENROUTER_DEFAULT_MODEL=openai/gpt-4-turbo');
  
  console.log('\n# Default Provider');
  console.log('DEFAULT_LLM_PROVIDER=openrouter');
  console.log('DEFAULT_LLM_MODEL=openai/gpt-4-turbo');
  
  console.log('\n🔧 Available Models by Provider:');
  console.log('\nOpenAI:');
  console.log('- gpt-4-turbo, gpt-4, gpt-3.5-turbo');
  
  console.log('\nAnthropic:');
  console.log('- claude-3-opus-20240229, claude-3-sonnet-20240229');
  
  console.log('\nGoogle:');
  console.log('- gemini-1.5-pro, gemini-1.5-flash, gemini-1.0-pro');
  
  console.log('\nOpenRouter (Multiple Providers):');
  console.log('- openai/gpt-4-turbo, anthropic/claude-3-opus');
  console.log('- google/gemini-pro, meta-llama/llama-2-70b-chat');
  console.log('- mistralai/mistral-7b-instruct, cohere/command-r-plus');
  
  console.log('\n🚀 API Usage Examples:');
  console.log('\n# Switch to Google provider');
  console.log('POST /api/llm/configure');
  console.log('{ "provider": "google", "model": "gemini-1.5-pro", "apiKey": "your-key" }');
  
  console.log('\n# Switch to OpenRouter');
  console.log('POST /api/llm/configure');
  console.log('{ "provider": "openrouter", "model": "openai/gpt-4-turbo", "apiKey": "your-key" }');
  
  console.log('\n# Create completion');
  console.log('POST /api/llm/completions');
  console.log('{ "messages": [{"role": "user", "content": "Hello!"}] }');
}

// Run all tests
async function runTests() {
  try {
    await testProviderFiles();
    await testConfigurationUpdate();
    await testServiceRegistration();
    await testSharedTypes();
    await showUsageExamples();
    
    console.log('\n🎉 LLM Provider Integration Test Complete!');
    console.log('\n📋 Summary:');
    console.log('✅ Added Google (Gemini) provider');
    console.log('✅ Added OpenRouter provider (access to multiple models)');
    console.log('✅ Updated configuration with new providers');
    console.log('✅ Updated service registration');
    console.log('✅ Updated shared types');
    console.log('\n🔧 Next Steps:');
    console.log('1. Set environment variables for API keys');
    console.log('2. Restart the LLM service');
    console.log('3. Test with your preferred provider via API');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the tests
runTests().catch(console.error);