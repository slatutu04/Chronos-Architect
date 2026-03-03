"""
CHRONOS ARCHITECT - Technical Logic Definition
Motor: Antigravity (Python / Web Optimized)
"""

import asyncio
import math

class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def magnitude(self):
        return math.sqrt(self.x**2 + self.y**2)

class Entity:
    def __init__(self, x, y):
        self.pos = Vector(x, y)
        self.active = True

class Player(Entity):
    def __init__(self, x, y):
        super().__init__(x, y)
        self.energy = 100
        self.is_moving = False
    
    def update(self, delta_time, movement_input):
        self.is_moving = movement_input.magnitude() > 0
        speed = 200 # Real-world pixels per second
        self.pos += movement_input * speed * delta_time

class Enemy(Entity):
    def __init__(self, x, y, behavior="fixed"):
        super().__init__(x, y)
        self.behavior = behavior # fixed, drone
        self.last_shot = 0

    def update(self, delta_time, global_time_factor):
        # Enemies are affected by the global time factor
        effective_dt = delta_time * global_time_factor
        # Shooting logic and patrol logic here...

class ChronosEngine:
    def __init__(self):
        self.player = Player(100, 300)
        self.enemies = []
        self.global_time_factor = 0.05
        self.level = 1

    async def main_loop(self):
        """
        Principal loop compatível com asyncio (Web/Pyodide).
        """
        last_time = 0
        while True:
            # Emulação de Delta Time (padrão 60fps)
            dt = 0.016 
            
            # 1. Update Global Time Factor
            # Se o jogador para, o tempo desacelera para 5%
            self.global_time_factor = 1.0 if self.player.is_moving else 0.05
            
            # 2. Update Units
            self.player.update(dt, self.get_input())
            
            for enemy in self.enemies:
                enemy.update(dt, self.global_time_factor)
            
            # 3. Render / Logic Sync
            await asyncio.sleep(dt)

    def get_input(self):
        # Implementação de captura de teclado (WASD)
        return Vector(0, 0)

# Inicialização do Motor
if __name__ == "__main__":
    engine = ChronosEngine()
    print("Chronos Architect: Motor Antigravity Inicializado.")
    # asyncio.run(engine.main_loop())
