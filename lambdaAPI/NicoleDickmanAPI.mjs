import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { createHash } from 'node:crypto';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET = 'nicoledickman.com';
const lambdaClient = new LambdaClient({ region: 'us-east-1' });

export const handler = async (event) => {
  console.log('Path: ', event.path);
  console.log('httpMethod: ', event.httpMethod);
  let response = {
    statusCode: 501,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: 'No existe el endpoint ' + event.path }),
  };
  if (event.path == '/actualizar') response = await actualizaData(event);
  if (event.path == '/contenido') response = await getContenido(event);
  return response;
};
// Funciones de respuesta a endpoints
async function getContenido(event) {
  if (event.queryStringParameters.seccion) {
    const nombreJSON = event.queryStringParameters.seccion + (event.queryStringParameters.num ? `&num=${event.queryStringParameters.num}` : '') + '.json';
    try {
      const params = {
        Bucket: BUCKET,
        Key: `data/${nombreJSON}`
      };
      const { Body } = await s3Client.send(new GetObjectCommand(params));
      const bodyString = await Body.transformToString();
      console.log(bodyString);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: bodyString
      };
    } catch (error) {
      return {
        statusCode: 501,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          status: 'error',
          message: `No existe el archivo de datos ${nombreJSON}`
        })
      };
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'exito',
        message: `El archivo de datos es ${nombreJSON}`
      })
    };
  } else {
    return {
      statusCode: 501,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'error',
        message: 'La query es incorrecta, no se enviaron los parámetros correctos (seccion y/o num).'
      })
    };
  }
}
async function actualizaData(event) { // Invoca la función verificaNDdata que actualiza los JSON en S3
  try {
    const command = new InvokeCommand({
      FunctionName: 'arn:aws:lambda:us-east-1:696912647258:function:verificaNDdata',
      InvocationType: 'Event' // Ejecución asíncrona
    });
    await lambdaClient.send(command);
    console.log('NicoleDickmanAPI: Lambda function invoked successfully.');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'exito',
        message: 'Proceso de actualización de datos correcto.'
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'error',
        message: 'Se falló al actualizar los datos.'
      })
    };
  }
};
// Funciones auxliares
function creaParams(params) {
  const keys = Object.keys(params);
  return '?' + keys.map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
};