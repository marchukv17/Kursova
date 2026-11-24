import { Router } from 'express';

export function createItemsRouter({ itemService }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.status(200).json(itemService.list());
  });

  return router;
}
