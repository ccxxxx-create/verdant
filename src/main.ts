import Phaser from 'phaser';
import { gameConfig } from './game.config';

const game = new Phaser.Game(gameConfig);

// 测试钩子：e2e/调试用（读场景状态、纹理数）
(window as unknown as { __game?: Phaser.Game }).__game = game;
