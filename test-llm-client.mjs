// Simple test client for the LLM service
import fetch from 'node-fetch';

async function testLlmService() {
  console.log('Testing LLM service API...');
  
  // URLs to test
  const apiGatewayUrl = 'http://localhost:8080';
  const llmServiceUrl = 'http://localhost:4002';
  
  // Test API Gateway
  console.log('\nTesting API Gateway completions/stream endpoint:');
  try {
    const gatewayResponse = await fetch(`${apiGatewayUrl}/api/llm/completions/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
            id: 'sys1',
            sessionId: 'test-session',
            timestamp: new Date()
          },
          {
            role: 'user',
            content: 'Say hello',
            id: 'user1',
            sessionId: 'test-session',
            timestamp: new Date()
          }
        ]
      })
    });
    
    console.log('Status:', gatewayResponse.status);
    console.log('Status Text:', gatewayResponse.statusText);
    console.log('Headers:', JSON.stringify(Object.fromEntries([...gatewayResponse.headers]), null, 2));
    
    // Try to get the response body
    if (gatewayResponse.status !== 200) {
      const responseText = await gatewayResponse.text();
      console.log('Response:', responseText);
    }
  } catch (error) {
    console.error('Error testing API Gateway:', error.message);
  }
  
  // Test direct LLM service
  console.log('\nTesting direct LLM service completions/stream endpoint:');
  try {
    const llmResponse = await fetch(`${llmServiceUrl}/api/llm/completions/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
            id: 'sys1',
            sessionId: 'test-session',
            timestamp: new Date()
          },
          {
            role: 'user',
            content: 'Say hello',
            id: 'user1',
            sessionId: 'test-session',
            timestamp: new Date()
          }
        ]
      })
    });
    
    console.log('Status:', llmResponse.status);
    console.log('Status Text:', llmResponse.statusText);
    console.log('Headers:', JSON.stringify(Object.fromEntries([...llmResponse.headers]), null, 2));
    
    // Try to get the response body
    if (llmResponse.status !== 200) {
      const responseText = await llmResponse.text();
      console.log('Response:', responseText);
    }
  } catch (error) {
    console.error('Error testing LLM service directly:', error.message);
  }
}

testLlmService().catch(console.error);