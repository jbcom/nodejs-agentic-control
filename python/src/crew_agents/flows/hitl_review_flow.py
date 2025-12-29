"""HITL Review Flow - Human-in-the-loop review with Material-UI controls."""

from __future__ import annotations

from crewai.flow.flow import Flow, listen, start
from pydantic import BaseModel


class HITLReviewState(BaseModel):
    """State for HITL Review workflow."""

    id: str = ""
    content_type: str = ""
    content_url: str = ""
    rating: int = 0
    notes: str = ""
    approved: bool = False


class HITLReviewFlow(Flow[HITLReviewState]):
    """Present content for human review with standardized controls.

    Controls (from HITLReviewControls.tsx):
    - Slider (1-10 rating)
    - Notes text area
    - REJECT / SAVE buttons
    """

    initial_state = HITLReviewState
    name = "hitl_review_flow"

    @start()
    def present_for_review(self):
        """Display content with review controls."""
        print("\n" + "=" * 50)
        print("HUMAN REVIEW REQUIRED")
        print("=" * 50)
        print(f"Content Type: {self.state.content_type}")
        print(f"Content URL: {self.state.content_url}")
        print("\nPlease review using the HITLReviewControls interface")
        print("=" * 50)

        # In production, this waits for actual human input
        # For now, simulate approval
        return {"content_type": self.state.content_type, "content_url": self.state.content_url}

    @listen(present_for_review)
    def collect_feedback(self, content):
        """Collect rating, notes, and approval decision."""
        # This would integrate with src/components/HITLReviewControls.tsx
        # For now, simulate feedback

        self.state.rating = 8
        self.state.notes = "Looks good, approved for integration"
        self.state.approved = True

        print("\nReview collected:")
        print(f"  Rating: {self.state.rating}/10")
        print(f"  Notes: {self.state.notes}")
        print(f"  Approved: {self.state.approved}")

        return {
            "rating": self.state.rating,
            "notes": self.state.notes,
            "approved": self.state.approved,
        }
