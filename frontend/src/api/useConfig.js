import { useQuery } from '@tanstack/react-query';
import client from './client';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await client.get('/api/config/');
      return res.data;
    },
    staleTime: Infinity,
  });
}
