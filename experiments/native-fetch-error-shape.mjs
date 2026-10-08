// Shows how Node's built-in fetch reports network failures compared with
// node-fetch: a TypeError('fetch failed') whose cause carries the real reason.
import { captureResponse } from '../js/src/transport.js';

try {
  await fetch('http://127.0.0.1:9/');
} catch (error) {
  console.log({
    name: error.name,
    isTypeError: error instanceof TypeError,
    message: error.message,
    cause: error.cause?.message,
    code: error.cause?.code,
  });
}

try {
  await captureResponse('http://127.0.0.1:9/');
} catch (error) {
  console.log(error.diagnostics);
}
