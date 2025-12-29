"""Batch Generation Flow - Generate multiple species/biomes in parallel."""

from __future__ import annotations

from typing import Any

from crewai.flow.flow import Flow, listen, start
from pydantic import BaseModel


class BatchGenerationState(BaseModel):
    """State for Batch Generation workflow."""

    id: str = ""
    species_list: list[str] = []
    generation_results: dict[str, Any] = {}


class BatchGenerationFlow(Flow[BatchGenerationState]):
    """Generate multiple assets in batch mode.

    Uses parallel execution for efficiency.
    """

    initial_state = BatchGenerationState
    name = "batch_generation_flow"

    @start()
    def prepare_batch(self):
        """Prepare list of species to generate."""
        print(f"\nPreparing batch generation for {len(self.state.species_list)} species")
        return self.state.species_list

    @listen(prepare_batch)
    def generate_all_species(self, species_list):
        """Generate all species in parallel."""
        from mesh_toolkit.services.text3d_service import Text3DService

        service = Text3DService()
        results = {}

        for species in species_list:
            print(f"Submitting generation for: {species}")
            result = service.submit_task(
                species=species, prompt=f"A realistic {species} suitable for a game environment"
            )
            results[species] = {"task_id": result.task_id, "status": "submitted"}

        self.state.generation_results = results
        print(f"\n{len(results)} species submitted for generation")
        return results

    @listen(generate_all_species)
    def monitor_progress(self, results):
        """Monitor generation progress."""
        print("\nMonitoring batch generation progress...")
        print(f"Total species: {len(results)}")

        # In production, this polls for completion
        return {"total": len(results), "completed": 0, "in_progress": len(results)}
