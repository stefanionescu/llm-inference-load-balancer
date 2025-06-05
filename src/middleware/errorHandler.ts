import http from 'http';

export const errorHandler = (error: any, res: http.ServerResponse) => {
  console.error('Error:', error);
  
  const errorResponse = {
    error: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  };

  res.statusCode = error.status || 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(errorResponse));
};