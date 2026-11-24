import { Router } from 'express';

export function createLinksRouter({ linkService, idemStore }) {
  const router = Router();

  router.get('/', (req, res) => {
    res.status(200).json({ items: linkService.list(), requestId: req.rid });
  });

  router.post('/', (req, res) => {
    const key = req.get('Idempotency-Key');

    if (key) {
      const previous = idemStore.get(key);
      if (previous) {
        return res.status(previous.status).json({ ...previous.body, requestId: req.rid });
      }

      const body = linkService.create(req.body);
      idemStore.set(key, { status: 201, body });
      return res.status(201).json({ ...body, requestId: req.rid });
    }

    const body = linkService.create(req.body);
    return res.status(201).json({ ...body, requestId: req.rid });
  });

  router.get('/:id', (req, res) => {
    res.status(200).json({ ...linkService.getById(req.params.id), requestId: req.rid });
  });

  const updateHandler = (req, res) => {
    res.status(200).json({ ...linkService.update(req.params.id, req.body), requestId: req.rid });
  };

  router.put('/:id', updateHandler);
  router.patch('/:id', updateHandler);

  router.delete('/:id', (req, res) => {
    linkService.remove(req.params.id);
    res.status(204).end();
  });

  return router;
}
