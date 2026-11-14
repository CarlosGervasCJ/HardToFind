# missions/registry.py
from .base import BaseMissionAdapter


class MissionRegistry:
    """
    Registro central de missões disponíveis no sistema.

    Uso:
        registry = MissionRegistry()
        registry.register("wise", WiseMissionAdapter(...))
        registry.register("spherex", SpherexMissionAdapter(...))

        adapter = registry.get("spherex")   # → SpherexMissionAdapter
        print(registry.list_missions())     # → ["wise", "spherex"]
    """

    def __init__(self):
        self._adapters: dict[str, BaseMissionAdapter] = {}

    def register(self, name: str, adapter: BaseMissionAdapter) -> None:
        """Registra um adaptador sob o nome canônico `name`."""
        if not isinstance(adapter, BaseMissionAdapter):
            raise TypeError(
                f"O adaptador para '{name}' deve herdar de BaseMissionAdapter."
            )
        self._adapters[name] = adapter

    def get(self, name: str) -> BaseMissionAdapter:
        """Retorna o adaptador registrado ou lança ValueError."""
        if name not in self._adapters:
            available = ", ".join(self._adapters) or "(nenhuma)"
            raise ValueError(
                f"Missão '{name}' não registrada. "
                f"Missões disponíveis: {available}."
            )
        return self._adapters[name]

    def list_missions(self) -> list[str]:
        """Retorna a lista de nomes de missões registradas."""
        return list(self._adapters.keys())

    def __contains__(self, name: str) -> bool:
        return name in self._adapters
