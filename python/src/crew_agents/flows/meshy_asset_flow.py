"""Meshy Asset Pipeline Flow - Generate → Rig → Animate → Retexture → Review."""

from __future__ import annotations

from typing import Any

from crewai.flow.flow import Flow, listen, start
from pydantic import BaseModel


class MeshyAssetState(BaseModel):
    """State for Meshy Asset workflow."""

    id: str = ""
    species: str = ""
    prompt: str = ""
    retexture_prompt: str = ""
    static_task_id: str = ""
    rigged_task_id: str = ""
    animations: list[dict[str, Any]] = []
    retexture_task_id: str = ""
    review_results: dict[str, Any] = {}


class MeshyAssetFlow(Flow[MeshyAssetState]):
    """Standard sequence for generating GLB assets via Meshy API.

    Steps:
    1. Generate static 3D model from text
    2. Add skeleton rigging
    3. Generate animation variants (parallel)
    4. Create retextured variant
    5. Human review of all variants
    """

    initial_state = MeshyAssetState
    name = "meshy_asset_flow"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._factory = None

    @property
    def factory(self):
        """Lazy-load service factory."""
        if self._factory is None:
            from mesh_toolkit.services.factory import ServiceFactory

            self._factory = ServiceFactory()
        return self._factory

    @start()
    def generate_static_model(self):
        """Text-to-3D static model generation."""
        service = self.factory.text3d()
        callback_url = self.factory.webhook_url(self.state.species, "static")

        result = service.submit_task(
            species=self.state.species, prompt=self.state.prompt, callback_url=callback_url
        )

        self.state.static_task_id = result.task_id
        print(f"Static model task submitted: {result.task_id}")
        return result

    @listen(generate_static_model)
    def rig_model(self, static_result):
        """Add skeleton to model."""
        service = self.factory.rigging()
        callback_url = self.factory.webhook_url(self.state.species, "rigged")

        result = service.submit_task(
            species=self.state.species, model_id=static_result.task_id, callback_url=callback_url
        )

        self.state.rigged_task_id = result.task_id
        print(f"Rigging task submitted: {result.task_id}")
        return result

    @listen(rig_model)
    def animate_variants(self, rigged_result):
        """Trigger parallel animation tasks."""
        service = self.factory.animation()

        # Submit walk animation
        walk_callback = self.factory.webhook_url(self.state.species, "walk")
        walk = service.submit_task(
            species=self.state.species,
            model_id=rigged_result.task_id,
            animation_id="1",  # Walk
            callback_url=walk_callback,
        )

        # Submit attack animation
        attack_callback = self.factory.webhook_url(self.state.species, "attack")
        attack = service.submit_task(
            species=self.state.species,
            model_id=rigged_result.task_id,
            animation_id="4",  # Attack
            callback_url=attack_callback,
        )

        self.state.animations = [
            {"name": "walk", "task_id": walk.task_id},
            {"name": "attack", "task_id": attack.task_id},
        ]

        print(f"Animation tasks submitted: walk={walk.task_id}, attack={attack.task_id}")
        return {"walk": walk, "attack": attack}

    @listen(animate_variants)
    def retexture_variant(self, anim_results):
        """Create color variant."""
        service = self.factory.retexture()
        callback_url = self.factory.webhook_url(self.state.species, "retextured")

        result = service.submit_task(
            species=self.state.species,
            model_id=self.state.static_task_id,
            prompt=self.state.retexture_prompt,
            callback_url=callback_url,
        )

        self.state.retexture_task_id = result.task_id
        print(f"Retexture task submitted: {result.task_id}")
        return result

    @listen(retexture_variant)
    def hitl_review(self, retexture_result):
        """Present all variants for human review."""
        print("\n=== Asset Review Required ===")
        print(f"Static model: {self.state.static_task_id}")
        print(f"Walk animation: {self.state.animations[0]['task_id']}")
        print(f"Attack animation: {self.state.animations[1]['task_id']}")
        print(f"Retextured variant: {self.state.retexture_task_id}")

        # In production, this loads HITLReviewControls with all 4 GLBs
        # TODO: Integrate with actual HITL review UI
        review_results = {
            "static": {"approved": True, "rating": 8},
            "walk": {"approved": True, "rating": 7},
            "attack": {"approved": True, "rating": 9},
            "variant": {"approved": True, "rating": 8},
            "notes": "All variants look good, ready for integration",
        }

        self.state.review_results = review_results
        return review_results
