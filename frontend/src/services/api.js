import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:3000',
});

export const uploadDocument = (formData) => {
  return API.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
