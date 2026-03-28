import { Router, type IRouter } from "express";
import healthRouter from "./health";
import detectRouter from "./detect";
import playlistRouter from "./playlist";

const router: IRouter = Router();

router.use(healthRouter);
router.use(detectRouter);
router.use(playlistRouter);

export default router;
