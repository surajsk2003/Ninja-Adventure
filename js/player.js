import { TILES } from './constants.js';

export class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 48;
        this.vx = 0;
        this.vy = 0;
        this.speed = 5;
        this.jumpPower = 15;
        this.grounded = false;
        this.direction = 1;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.state = 'idle'; // idle, run, jump
        this.inQuicksand = false;
        this.onIce = false;
        this.checkpoint = { x: x, y: y };
    }

    update() {
        // Reset special surface effects
        this.inQuicksand = false;
        this.onIce = false;
        
        // Handle input
        if (this.game.keys['ArrowLeft']) {
            this.vx = -this.speed * (this.inQuicksand ? 0.5 : 1);
            this.direction = -1;
            this.state = 'run';
        } else if (this.game.keys['ArrowRight']) {
            this.vx = this.speed * (this.inQuicksand ? 0.5 : 1);
            this.direction = 1;
            this.state = 'run';
        } else {
            // Apply friction based on surface
            if (this.onIce) {
                this.vx *= 0.95; // Less friction on ice
            } else if (this.inQuicksand) {
                this.vx *= 0.7; // More friction in quicksand
            } else {
                this.vx *= 0.8; // Normal friction
            }
            this.state = 'idle';
        }

        if ((this.game.keys[' '] || this.game.keys['ArrowUp']) && this.grounded) {
            // Adjust jump power based on surface
            let jumpMultiplier = 1;
            if (this.inQuicksand) jumpMultiplier = 0.7;
            if (this.onIce) jumpMultiplier = 1.1;
            
            this.vy = -this.jumpPower * jumpMultiplier;
            this.grounded = false;
            this.state = 'jump';
            this.game.playSound('jump');
        }

        // Apply gravity
        this.vy += 0.5;
        if (this.vy > 15) this.vy = 15;

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Handle invulnerability
        if (this.invulnerable && this.invulnerableTime > 0) {
            this.invulnerableTime--;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }

        // Collision detection
        this.handleCollisions();

        // Update camera
        this.game.camera.x = this.x - this.game.canvas.width / 2;
        if (this.game.camera.x < 0) this.game.camera.x = 0;
        const maxCameraX = this.game.level.width * this.game.level.TILE_SIZE - this.game.canvas.width;
        if (this.game.camera.x > maxCameraX) {
            this.game.camera.x = maxCameraX;
        }
    }

    handleCollisions() {
        this.grounded = false;

        // Tile collision
        for (let row = 0; row < this.game.level.tiles.length; row++) {
            for (let col = 0; col < this.game.level.tiles[row].length; col++) {
                const tile = this.game.level.tiles[row][col];
                if (tile === TILES.GROUND || tile === TILES.BRICK) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y < tileY + this.game.level.TILE_SIZE &&
                        this.y + this.height > tileY) {
                        
                        // Collision resolution
                        const overlapX = Math.min(this.x + this.width - tileX, tileX + this.game.level.TILE_SIZE - this.x);
                        const overlapY = Math.min(this.y + this.height - tileY, tileY + this.game.level.TILE_SIZE - this.y);

                        if (overlapX < overlapY) {
                            if (this.x < tileX) {
                                this.x = tileX - this.width;
                            } else {
                                this.x = tileX + this.game.level.TILE_SIZE;
                            }
                            this.vx = 0;
                        } else {
                            if (this.y < tileY) {
                                this.y = tileY - this.height;
                                this.vy = 0;
                                this.grounded = true;
                                if (this.state === 'jump') {
                                    this.state = 'idle';
                                }
                            } else {
                                this.y = tileY + this.game.level.TILE_SIZE;
                                this.vy = 0;
                            }
                        }
                    }
                } else if (tile === TILES.COIN) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y < tileY + this.game.level.TILE_SIZE &&
                        this.y + this.height > tileY) {
                        
                        this.game.level.tiles[row][col] = TILES.AIR;
                        this.game.collectCoin();
                    }
                } else if (tile === TILES.FLAG) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y < tileY + this.game.level.TILE_SIZE &&
                        this.y + this.height > tileY) {
                        
                        // Level complete
                        this.game.score += 1000;
                        this.game.levelCompleted();
                    }
                } else if (tile === TILES.SPIKE) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y < tileY + this.game.level.TILE_SIZE &&
                        this.y + this.height > tileY && !this.invulnerable) {
                        
                        this.takeDamage();
                    }
                } else if (tile === TILES.POWERUP_SPEED || 
                           tile === TILES.POWERUP_JUMP || 
                           tile === TILES.POWERUP_INVINCIBLE) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y < tileY + this.game.level.TILE_SIZE &&
                        this.y + this.height > tileY) {
                        
                        // Collect powerup
                        let powerupType;
                        let duration = 600; // 10 seconds at 60fps
                        
                        switch (tile) {
                            case TILES.POWERUP_SPEED:
                                powerupType = 'speed';
                                break;
                            case TILES.POWERUP_JUMP:
                                powerupType = 'jump';
                                break;
                            case TILES.POWERUP_INVINCIBLE:
                                powerupType = 'invincible';
                                break;
                        }
                        
                        this.game.level.tiles[row][col] = TILES.AIR;
                        this.game.activatePowerup(powerupType, duration);
                    }
                } else if (tile === TILES.QUICKSAND) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y + this.height > tileY &&
                        this.y + this.height < tileY + this.game.level.TILE_SIZE) {
                        
                        this.inQuicksand = true;
                        this.grounded = true;
                        
                        // Sink slowly into quicksand
                        if (this.y + this.height < tileY + this.game.level.TILE_SIZE * 0.7) {
                            this.y += 0.5;
                        }
                    }
                } else if (tile === TILES.ICE) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y + this.height > tileY &&
                        this.y + this.height < tileY + this.game.level.TILE_SIZE) {
                        
                        this.onIce = true;
                        this.grounded = true;
                    }
                } else if (tile === TILES.CACTUS) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y < tileY + this.game.level.TILE_SIZE &&
                        this.y + this.height > tileY && !this.invulnerable) {
                        
                        this.takeDamage();
                    }
                } else if (tile === TILES.CHECKPOINT) {
                    const tileX = col * this.game.level.TILE_SIZE;
                    const tileY = row * this.game.level.TILE_SIZE;

                    if (this.x < tileX + this.game.level.TILE_SIZE &&
                        this.x + this.width > tileX &&
                        this.y < tileY + this.game.level.TILE_SIZE &&
                        this.y + this.height > tileY) {
                        
                        // Set checkpoint
                        this.checkpoint = { x: this.x, y: this.y };
                        
                        // Visual feedback
                        if (!this.checkpointActivated) {
                            this.game.playSound('powerup');
                            this.checkpointActivated = true;
                        }
                    }
                }
            }
        }

        // World bounds
        if (this.y > this.game.canvas.height) {
            this.takeDamage();
        }
    }

    takeDamage() {
        if (this.invulnerable) return;
        
        this.game.lives--;
        this.invulnerable = true;
        this.invulnerableTime = 120; // 2 seconds at 60fps
        this.game.playSound('hurt');
        
        if (this.game.lives <= 0) {
            this.game.gameOver();
        } else {
            // Reset to checkpoint or start position
            this.x = this.checkpoint.x;
            this.y = this.checkpoint.y;
            this.vx = 0;
            this.vy = 0;
        }
        this.game.updateUI();
    }

    draw() {
        const ctx = this.game.ctx;
        ctx.save();
        if (this.invulnerable && Math.floor(this.invulnerableTime / 5) % 2) {
            ctx.globalAlpha = 0.5;
        }
        
        // Choose the right sprite based on state
        let playerImage;
        if (this.state === 'idle') {
            playerImage = this.game.assets.images.player;
        } else if (this.state === 'run') {
            playerImage = this.game.assets.images.playerRun;
        } else if (this.state === 'jump') {
            playerImage = this.game.assets.images.playerJump;
        }
        
        if (playerImage) {
            // Draw sprite with correct direction
            ctx.save();
            if (this.direction === -1) {
                ctx.translate(this.x - this.game.camera.x + this.width, this.y - this.game.camera.y);
                ctx.scale(-1, 1);
                ctx.drawImage(playerImage, 0, 0, this.width, this.height);
            } else {
                ctx.drawImage(
                    playerImage,
                    this.x - this.game.camera.x,
                    this.y - this.game.camera.y,
                    this.width,
                    this.height
                );
            }
            ctx.restore();
        } else {
            // Fallback to rectangle
            ctx.fillStyle = '#FF4444';
            ctx.fillRect(this.x - this.game.camera.x, this.y - this.game.camera.y, this.width, this.height);
            
            // Simple face
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x - this.game.camera.x + 4, this.y - this.game.camera.y + 6, 4, 4);
            ctx.fillRect(this.x - this.game.camera.x + 16, this.y - this.game.camera.y + 6, 4, 4);
        }
        
        ctx.restore();
    }
}